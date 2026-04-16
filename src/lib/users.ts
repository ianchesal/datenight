// src/lib/users.ts
import { getConfig } from './config'
import type { User } from '@/types'

export const USER_KEYS: User[] = ['user1', 'user2']

export async function getUserNames(): Promise<Record<User, string>> {
  const config = await getConfig()
  return {
    user1: config.user1Name || 'User 1',
    user2: config.user2Name || 'User 2',
  }
}

export function otherUser(user: User): User {
  return user === 'user1' ? 'user2' : 'user1'
}
