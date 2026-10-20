import { memberStore, type MemberProfile } from '../data/member-store'

export type { MemberProfile }

/** 账号查询的用例编排；SQL 一律在 data/member-store */
export const MemberService = {
  list(keyword?: string, page = 1, pageSize = 20) {
    return memberStore.page(keyword, page, pageSize)
  },
  getById(id: number): Promise<MemberProfile | undefined> {
    return memberStore.findById(id)
  },
  getByUsername(username: string): Promise<MemberProfile | undefined> {
    return memberStore.findByLoginName(username)
  },
}
