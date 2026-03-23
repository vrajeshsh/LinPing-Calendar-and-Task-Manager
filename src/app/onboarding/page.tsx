import { Button } from "@/components/ui/button"
import { AuthCard } from "@/components/auth/AuthCard"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { DEFAULT_TEMPLATE } from "@/lib/defaultData"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // Check if already onboarded
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single()

  if (profile?.onboarded) {
    return redirect("/")
  }

  async function completeOnboarding() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Create default template
    const { data: template, error: tError } = await supabase
      .from("schedule_templates")
      .insert({
        user_id: user.id,
        name: "My Ideal Day",
        is_default: true
      })
      .select()
      .single()

    if (tError) {
        console.error("Template error:", tError)
        return
    }

    // 2. Create blocks for template
    const blocks = DEFAULT_TEMPLATE.blocks.map((b, i) => ({
      template_id: template.id,
      title: b.title,
      start_time: b.startTime,
      end_time: b.endTime,
      type: b.type,
      order_index: i
    }))

    const { error: bError } = await supabase
      .from("template_blocks")
      .insert(blocks)

    if (bError) {
        console.error("Blocks error:", bError)
        return
    }

    // 3. Mark as onboarded
    await supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", user.id)

    redirect("/")
  }

  return (
    <AuthCard 
      title="Welcome to LinPing" 
      subtitle="Let's set up your ideal daily rhythm"
    >
      <div className="space-y-6">
        <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
          <p className="text-sm text-center text-muted-foreground mb-4">
            We've prepared a default high-performance schedule for you. You can customize it anytime.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {DEFAULT_TEMPLATE.blocks.map((block, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="font-medium">{block.title}</span>
                <span className="text-muted-foreground">{block.startTime} – {block.endTime}</span>
              </div>
            ))}
          </div>
        </div>

        <form action={completeOnboarding}>
          <Button type="submit" className="w-full h-10 rounded-xl" size="lg">
            Complete Setup
          </Button>
        </form>
      </div>
    </AuthCard>
  )
}
