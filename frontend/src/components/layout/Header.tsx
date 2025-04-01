'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Microscope, Stethoscope, User, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      router.push('/')
    } catch (error) {
      console.error('Failed to log out:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Create initials from user display name
  const getUserInitials = () => {
    if (!user?.displayName) return 'U'
    
    const names = user.displayName.split(' ')
    if (names.length === 1) return names[0].charAt(0).toUpperCase()
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
  }

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm fixed w-full top-0 z-10">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Microscope className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-gray-800">Medical Consultation Assistant</span>
        </Link>
        <nav className="hidden md:flex gap-6">
          <Link 
            href="/consultation" 
            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600 flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-blue-50"
          >
            <Stethoscope className="h-4 w-4" />
            <span>Consultation</span>
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border border-gray-200">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{user.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer text-red-600 focus:text-red-600" 
                  disabled={isLoggingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900">
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/auth/register">Sign up</Link>
              </Button>
              <Button variant="ghost" size="icon" asChild className="sm:hidden">
                <Link href="/auth/login">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Login</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}