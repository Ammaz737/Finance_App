import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const organization = await prisma.organization.create({ data: { name: "Beta E2E", slug: "beta-e2e" } });
  const entity = await prisma.legalEntity.create({ data: { organizationId: organization.id, name: "Beta US", country: "US", currency: "USD" } });
  const role = await prisma.role.create({ data: { organizationId: organization.id, name: "Owner", description: "E2E isolation owner" } });
  const permission = await prisma.permission.findUniqueOrThrow({ where: { key: "*" } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  const user = await prisma.user.create({ data: { organizationId: organization.id, email: "admin@beta.test", passwordHash, firstName: "Beta", lastName: "Owner", status: "ACTIVE" } });
  await prisma.userRole.create({ data: { organizationId: organization.id, userId: user.id, roleId: role.id, entityId: entity.id } });
  await prisma.entitlement.createMany({ data: ["cards", "expenses", "bill_pay", "accounting"].map((featureKey) => ({ organizationId: organization.id, featureKey })) });
}

main().finally(() => prisma.$disconnect());
