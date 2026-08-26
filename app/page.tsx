import { redirect } from 'next/navigation';
<<<<<<< HEAD

export default function HomePage() {
=======
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/search');
  }

>>>>>>> 0c18f7c (add redirect for root domain for non-logged in users + changed placeholder text in sales search)
  redirect('/login');
}
