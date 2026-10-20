import React, { useEffect, useMemo, useState } from 'react'
import styles from './credit-operations.module.css'
import ConfirmOverlay from './confirm-dialog'
import { formatDateTime } from './format'
import type { LedgerEntry, CreditKind, MemberOption } from './types'
import api from './http-client'
import { useNavigate } from 'react-router-dom'

const EMPTY_MEMBERS: MemberOption[] = []

const CreditOperations: React.FC = () => {
  const operatorName = localStorage.getItem('prism.console.account') || 'operator_001'
  const navigate = useNavigate()
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [type, setType] = useState<CreditKind | null>(null)
  const [amount, setAmount] = useState<string>('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([])
  const [openConfirm, setOpenConfirm] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const [errors, setErrors] = useState<{ member: boolean; type: boolean; amount: boolean }>({ member: false, type: false, amount: false })

  const [members, setMembers] = useState<MemberOption[]>(EMPTY_MEMBERS)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerPageSize, setLedgerPageSize] = useState(10)
  const [filterMemberInput, setFilterMemberInput] = useState<string>('')
  const [filterTypeInput, setFilterTypeInput] = useState<'all' | CreditKind>('all')
  const [filterMember, setFilterMember] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | CreditKind>('all')

  const applyFilters = () => {
    setFilterMember(filterMemberInput);
    setFilterType(filterTypeInput);
    setLedgerPage(1);
  };

  const clearFilters = () => {
    setFilterMemberInput('');
    setFilterTypeInput('all');
    setFilterMember('');
    setFilterType('all');
    setLedgerPage(1);
  };

  const selectedMember = useMemo(() =>
    members.find(m => m.id === selectedMemberId) || null,
  [selectedMemberId, members])

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])
  const pagedEntries = entries

  const ledgerCalc = useMemo(() => {
    const membersById: Record<string, MemberOption | undefined> = {}
    for (const m of members) membersById[m.id] = m
    let rows = allEntries.map(e => ({
      id: e.memberId,
      entry_id: e.id,
      loginName: e.memberName || membersById[e.memberId]?.loginName || e.memberId,
      creditBalance: e.balanceAfter,
      happenedAt: e.timestamp,
      kind: e.type,
      delta: e.delta,
    }))
    rows = rows.filter(row => {
      const matchMember = filterMember ? row.id === filterMember : true
      const matchType = filterType === 'all' ? true : (row.kind === filterType)
      return matchMember && matchType
    })
    const start = (ledgerPage - 1) * ledgerPageSize
    const paged = rows.slice(start, start + ledgerPageSize)
    return { total: rows.length, paged }
  }, [members, allEntries, ledgerPage, ledgerPageSize, filterMember, filterType])
  const ledgerTotal = ledgerCalc.total
  const ledgerPages = useMemo(() => Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize)), [ledgerTotal, ledgerPageSize])
  const ledgerRows = ledgerCalc.paged

  const kindLabel = (k: CreditKind) => ({
    recharge: '额度充值',
    deduct: '额度扣除',
    image: '静帧生成',
    video: '动态生成',
    refund: '额度返还',
  }[k])
  const optionLabel = (k: string) => ({
    recharge: '充值',
    deduct: '扣除'
  }[k])

  const kindTagClass = (k: CreditKind) => {
    switch (k) {
      case 'recharge': return styles.tagRecharge
      case 'refund': return styles.tagRefund
      case 'deduct': return styles.tagDeduct
      case 'image': return styles.tagImage
      case 'video': return styles.tagVideo
    }
  }
  const isCredit = (k: CreditKind) => k === 'recharge' || k === 'refund'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = {
      member: !selectedMemberId,
      type: !type,
      amount: !amount,
    }
    setErrors(nextErrors)
    if (nextErrors.member || nextErrors.type || nextErrors.amount) return
    setOpenConfirm(true)
  }

  const confirmAction = async () => {
    if (!selectedMember || !type) return
    try {
      await api.post('/console/credits', {
        memberId: Number(selectedMember.id),
        type,
        amount: Number(amount),
      })
      await loadEntries()
      await loadAllEntries()
      setOpenConfirm(false)
      setAmount('')
    } catch (err: any) {
      alert(err.message)
    }
  }

  const loadMembers = async () => {
    const { data } = await api.get('/console/members', { params: { page: 1, pageSize: 20 } })
    const list: MemberOption[] = data.rows.map((m: any) => ({ id: String(m.id), loginName: m.username, creditBalance: Number(m.creditBalance) }))
    setMembers(list)
  }

  const loadEntries = async () => {
    const { data } = await api.get('/console/credits/entries', { params: { page, pageSize, types: 'recharge,deduct' } })
    const list: LedgerEntry[] = data.rows.map((r: any) => ({
      id: String(r.id),
      timestamp: Date.parse(r.createdAt),
      memberId: String(r.memberId),
      memberName: r.memberName,
      operatorName: String(r.operatorName || ''),
      type: r.type,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
    }))
    setEntries(list)
    setTotal(data.total || list.length)
  }
  const loadAllEntries = async () => {
    const { data } = await api.get('/console/credits/entries', { params: { page: 1, pageSize: 500 } })
    const list: LedgerEntry[] = data.rows.map((r: any) => ({
      id: String(r.id),
      timestamp: Date.parse(r.createdAt),
      memberId: String(r.memberId),
      memberName: r.memberName,
      operatorName: String(r.operatorName || ''),
      type: r.type,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
    }))
    setAllEntries(list)
  }

  useEffect(() => { loadMembers(); loadEntries(); loadAllEntries() }, [])
  useEffect(() => { loadEntries() }, [page, pageSize])

  const signOut = () => {
    localStorage.removeItem('prism.console.token')
    localStorage.removeItem('prism.console.account')
    navigate('/console/sign-in')
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.topbar}>
        <div className={styles.brand}>额度运营台</div>
        <div className={styles.right}>
          <span className={styles.welcome}>你好，{operatorName}</span>
          <button className={styles.logout} onClick={signOut}>退出登录</button>
        </div>
      </header>
     <h2 className={styles.title}>额度运营台</h2>
      <section className={styles.panel}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>账号选择</label>
            <select
                value={selectedMemberId}
                className={errors.member ? styles.errorInput : ''}
                onFocus={() => setErrors(prev => ({...prev, member: false}))}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  if (e.target.value) setErrors(prev => ({...prev, member: false}))
                }}
            >
              <option value="" disabled>请选择账号</option>
              {members.map(m => (
                  <option key={m.id} value={m.id}>{m.loginName}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>操作类型</label>
            <div className={`${styles.radios} ${errors.type ? styles.radiosError : ''}`}>
              <label><input type="radio" checked={type === 'recharge'}
                            onFocus={() => setErrors(prev => ({...prev, type: false}))} onChange={() => {
                setType('recharge');
                setErrors(prev => ({...prev, type: false}))
              }}/> 充值</label>
              <label><input type="radio" checked={type==='deduct'} onFocus={() => setErrors(prev => ({ ...prev, type: false }))} onChange={() => { setType('deduct'); setErrors(prev => ({ ...prev, type: false })) }} /> 扣除</label>
          </div>
        </div>
        <div className={styles.field}>
          <label>额度数量</label>
          <input
            type="number"
            placeholder="请输入额度数量"
            value={amount}
            min="1"
            max="10000"
            className={errors.amount ? styles.errorInput : ''}
            onFocus={() => setErrors(prev => ({...prev, amount: false}))}
            onChange={(e) => { setAmount(e.target.value); if (e.target.value) setErrors(prev => ({...prev, amount: false})) }}
          />
        </div>
        <button className={styles.submit} type="submit">确认操作</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.rechargeDeductionTitle}>充值/扣除记录</h2>
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>操作时间</th>
              <th>账号信息</th>
              <th>操作类型</th>
              <th>额度数量</th>
              <th>操作人员</th>
            </tr>
          </thead>
          <tbody>
            {pagedEntries.map(e => (
              <tr key={e.id}>
                <td>{formatDateTime(e.timestamp)}</td>
                <td>{e.memberName}</td>
                <td>
                  <span className={kindTagClass(e.type)}>
                    {optionLabel(e.type)}
                  </span>
                </td>
                <td>
                  <span className={isCredit(e.type) ? styles.numPlus : styles.numMinus}>
                    {isCredit(e.type) ? '+' : '-'}{e.delta}
                  </span>
                </td>
                <td>{e.operatorName}</td>
              </tr>
            ))}
            {pagedEntries.length === 0 && (
              <tr><td colSpan={5} className={styles.empty}>暂无数据</td></tr>
            )}
          </tbody>
        </table>
        <div className={styles.pagination}>
          <span className={styles.totalTip}>共 {total} 条数据</span>
          <span>每页数量</span>
          <select value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value)); setPage(1)}}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button className={styles.pageBtn} disabled={page===1} onClick={()=>setPage(1)}>{'<<'}</button>
          <button className={styles.pageBtn} disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>{'<'}</button>
          <span className={styles.pageList}>
            {Array.from({length: pages}).slice(Math.max(0,page-3), Math.min(pages, page+2)).map((_,i)=>{
              const num = Math.max(1,page-2)+i
              return (
                <button key={num} className={`${styles.pageNum} ${num===page?styles.active:''}`} onClick={()=>setPage(num)}>{num}</button>
              )
            })}
          </span>
          <button className={styles.pageBtn} disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>{'>'}</button>
          <button className={styles.pageBtn} disabled={page>=pages} onClick={()=>setPage(pages)}>{'>>'}</button>
        </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.rechargeDeductionTitle}>账号额度记录</h2>
        <div className={styles.form} style={{gridTemplateColumns: 'repeat(3, max-content)', alignItems: 'end'}}>
          <div className={styles.field}>
            <label>账号</label>
            <select value={filterMemberInput} onChange={(e)=>setFilterMemberInput(e.target.value)}>
              <option value="">全部账号</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.loginName}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>额度类别</label>
            <select value={filterTypeInput} onChange={(e)=>setFilterTypeInput(e.target.value as any)}>
              <option value="all">全部</option>
              <option value="recharge">额度充值</option>
              <option value="deduct">额度扣除</option>
              <option value="image">静帧生成</option>
              <option value="video">动态生成</option>
              <option value="refund">额度返还</option>
            </select>
          </div>
          <div style={{display:'flex', gap:12}}>
            <button className={styles.submit} onClick={applyFilters} type="button">查询</button>
            <button className={styles.pageBtn} onClick={clearFilters} type="button">重置</button>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>账号</th>
                <th>操作时间</th>
                <th>额度类型</th>
                <th>额度变化</th>
                <th>当前余额</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.map(row => (
                <tr key={row.entry_id ?? row.id}>
                  <td>{row.loginName}</td>
                  <td>{row.happenedAt ? formatDateTime(row.happenedAt) : '-'}</td>
                  <td>
                    {row.kind ? (
                      <span className={kindTagClass(row.kind)}>
                        {kindLabel(row.kind)}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {row.delta != null ? (
                      <span className={isCredit(row.kind as CreditKind) ? styles.numPlus : styles.numMinus}>
                        {isCredit(row.kind as CreditKind) ? '+' : '-'}{row.delta}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{row.creditBalance ?? '-'}</td>
                </tr>
              ))}
              {ledgerRows.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>暂无数据</td></tr>
              )}
            </tbody>
          </table>
          <div className={styles.pagination}>
            <span className={styles.totalTip}>共 {ledgerTotal} 条数据</span>
            <span>每页数量</span>
            <select value={ledgerPageSize} onChange={(e)=>{setLedgerPageSize(Number(e.target.value)); setLedgerPage(1)}}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button className={styles.pageBtn} disabled={ledgerPage===1} onClick={()=>setLedgerPage(1)}>{'<<'}</button>
            <button className={styles.pageBtn} disabled={ledgerPage===1} onClick={()=>setLedgerPage(p=>Math.max(1,p-1))}>{'<'}</button>
            <span className={styles.pageList}>
              {Array.from({length: ledgerPages}).slice(Math.max(0,ledgerPage-3), Math.min(ledgerPages, ledgerPage+2)).map((_,i)=>{
                const num = Math.max(1,ledgerPage-2)+i
                return (
                  <button key={num} className={`${styles.pageNum} ${num===ledgerPage?styles.active:''}`} onClick={()=>setLedgerPage(num)}>{num}</button>
                )
              })}
            </span>
            <button className={styles.pageBtn} disabled={ledgerPage>=ledgerPages} onClick={()=>setLedgerPage(p=>Math.min(ledgerPages,p+1))}>{'>'}</button>
            <button className={styles.pageBtn} disabled={ledgerPage>=ledgerPages} onClick={()=>setLedgerPage(ledgerPages)}>{'>>'}</button>
          </div>
        </div>
      </section>

      <ConfirmOverlay
        open={openConfirm}
        content={`确认对账号【${selectedMember?.loginName || ''}】执行${type==='recharge' ? '充值' : '扣除'}操作，数量：${amount} 吗？`}
        onConfirm={confirmAction}
        onCancel={() => setOpenConfirm(false)}
      />
    </div>
  )
}
export default CreditOperations
