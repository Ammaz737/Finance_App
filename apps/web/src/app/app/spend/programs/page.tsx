"use client";
import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";
export default function Page() { const router = useRouter(); return <ResourcePage title="Spend programs" path="spend-programs" onRowNavigate={(row) => router.push(`/app/spend/programs/${row.id}`)} />; }
