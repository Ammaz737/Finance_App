"use client";
import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";
export default function Page() { const router = useRouter(); return <ResourcePage title="People" path="people" onRowNavigate={(row) => router.push(`/app/company/people/${row.id}`)} />; }
