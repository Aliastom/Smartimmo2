import { LoginPageCore } from '@/features/auth/LoginPageCore';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const redirect = searchParams?.redirect;
  return <LoginPageCore mode="normal" redirectPath={redirect} />;
}

