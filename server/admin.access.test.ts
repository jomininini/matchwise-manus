import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createNonOwnerContext(): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "non-owner-user",
      email: "member@example.com",
      name: "Member",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("public data-management access", () => {
  it("allows an unauthenticated workspace context to inspect official company imports", async () => {
    const caller = appRouter.createCaller(createNonOwnerContext());
    const imports = await caller.admin.imports();
    expect(Array.isArray(imports)).toBe(true);
    expect(imports.every(item => item.sourceType === "company")).toBe(true);
  });
});
