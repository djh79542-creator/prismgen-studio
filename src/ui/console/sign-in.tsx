import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from './http-client'
import styles from './sign-in.module.css'

const ConsoleSignIn: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = username.trim()
    const p = password.trim()
    if (!u || !p) return
    try {
      const { data } = await api.post('/console/session/sign-in', { username: u, password: p })
      localStorage.setItem('prism.console.token', data.accessToken)
      localStorage.setItem('prism.console.account', data.operator.loginName)
      navigate('/console/credits')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '登录失败'
      alert(msg)
    }
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.brandRow}>
          <span className={styles.brandIcon}>✦</span>
          <span className={styles.brandText}>管理平台</span>
          <span className={styles.brandDivider}>|</span>
          <span className={styles.brandAdmin}>ADMIN</span>
        </div>
        <div className={styles.subTitle}>请登录以继续使用</div>

        <label className={styles.label}>用户名</label>
        <input
          className={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="输入用户名"
        />
        <label className={styles.label}>密码</label>
        <div className={styles.inputPwdWrap}>
          <input
            className={styles.input}
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
          />
          <button
            type="button"
            aria-label={showPwd ? '隐藏密码' : '显示密码'}
            className={styles.eye}
            onClick={() => setShowPwd(s => !s)}
          >
            {showPwd ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10.73 6.05C11.14 6 11.56 6 12 6c5 0 8.82 3.11 10 6-0.43 1.12-1.1 2.19-2 3.16M6.06 6.06C4.33 7.38 3.08 9.07 2 12c0.74 1.93 2.01 3.57 3.59 4.79C7.09 18.89 9.45 20 12 20c1.35 0 2.64-0.22 3.85-0.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12c2-5 7-8 10-8s8 3 10 8c-2 5-7 8-10 8s-8-3-10-8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
        </div>
        <button className={styles.submit} type="submit">登录</button>
      </form>
    </div>
  )
}

export default ConsoleSignIn
