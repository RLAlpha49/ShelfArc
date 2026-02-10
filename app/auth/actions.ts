"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createUserClient } from "@/lib/supabase/server"
import { sanitizePlainText } from "@/lib/sanitize-html"

export async function login(formData: FormData) {
  const supabase = await createUserClient()

  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string

  if (!email?.includes("@")) {
    return { error: "Valid email is required" }
  }
  if (!password) {
    return { error: "Password is required" }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/library")
}

export async function signup(formData: FormData) {
  const supabase = await createUserClient()

  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const displayName = formData.get("displayName") as string

  if (!email?.includes("@")) {
    return { error: "Valid email is required" }
  }
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" }
  }

  const sanitizedDisplayName = sanitizePlainText(displayName || "", 100)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: sanitizedDisplayName || null
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
