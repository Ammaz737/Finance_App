"use client";
import { useRouter } from "next/navigation";
import { ResourcePage } from "@/components/ResourcePage";
export default function RolesPage() { const router = useRouter(); return <ResourcePage title="Roles" path="rbac" onRowNavigate={(row) => router.push(`/app/company/roles/${row.id}`)} />; }
