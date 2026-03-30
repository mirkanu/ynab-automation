import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import { prisma } from '@/lib/db'
import { assignForwardingAddress } from '@/lib/email-forwarding'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com',
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    authorized({ auth: sessionData }) {
      // Middleware: allow access only if session exists
      return !!sessionData
    },
    session({ session, user }) {
      // With database strategy, user object (not token) is provided
      if (session.user && user) {
        session.user.id = user.id
      }
      return session
    },
  },
  events: {
    createUser: async ({ user }) => {
      // Assign unique Postmark forwarding address on first signup (EMAIL-01)
      if (user.id) {
        try {
          await assignForwardingAddress(user.id);
        } catch (err) {
          // Non-fatal: user can still sign in; address can be assigned retroactively
          console.error('Failed to assign forwarding address for user', user.id, err);
        }
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
})
