import { redirect } from 'next/navigation';

interface TenantsIdRedirectProps {
  params: {
    id: string;
  };
}

export default function TenantsIdRedirect({ params }: TenantsIdRedirectProps) {
  redirect(`/locataires/${params.id}`);
}
