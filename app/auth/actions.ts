"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const supabase = await createUserClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/library")
}

export async function signup(formData: FormData) {
  const supabase = await createUserClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const displayName = formData.get("displayName") as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/library")
}

export async function logout() {
  const supabase = await createUserClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

export async function getUser() {
  const supabase = await createUserClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}
