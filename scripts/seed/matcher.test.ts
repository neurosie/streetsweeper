import { describe, test, expect } from "vitest";
import { shouldExclude } from "./matcher";

describe("shouldExclude", () => {
  test("excludes Maine unorganized territories", () => {
    expect(shouldExclude("T1 R8 WELS")).toBe(true);
    expect(shouldExclude("T1 R8")).toBe(true);
    expect(shouldExclude("TA R7")).toBe(true);
  });

  test("excludes campgrounds", () => {
    expect(shouldExclude("Baxter Campground")).toBe(true);
    expect(shouldExclude("Sunset Camping Area")).toBe(true);
  });

  test("excludes unincorporated areas and generic townships", () => {
    expect(shouldExclude("Unincorporated Clark County")).toBe(true);
    expect(shouldExclude("Township 12")).toBe(true);
    expect(shouldExclude("Township E")).toBe(true);
  });

  test("excludes numbered municipal wards", () => {
    // NY seeds these as admin_level=7 relations; they're electoral
    // subdivisions of a city, not municipalities
    for (let i = 1; i <= 8; i++) {
      expect(shouldExclude(`Ward ${i}`)).toBe(true);
    }
    expect(shouldExclude("ward 3")).toBe(true);
  });

  test("excludes historic districts miscategorized as municipalities", () => {
    expect(shouldExclude("Kingsboro Historic District")).toBe(true);
    // ...but not a town that merely has one
    expect(shouldExclude("Historic District Heights")).toBe(false);
  });

  test("keeps real places whose names contain Ward", () => {
    // Ward is a genuine municipality in AR, CO, SC and SD
    expect(shouldExclude("Ward")).toBe(false);
    expect(shouldExclude("Ward Township")).toBe(false);
    expect(shouldExclude("La Ward")).toBe(false);
    expect(shouldExclude("Warden")).toBe(false);
    expect(shouldExclude("Wardsville")).toBe(false);
    expect(shouldExclude("Wardensville")).toBe(false);
    expect(shouldExclude("Ward 1 Township")).toBe(false);
  });

  test("keeps ordinary city names", () => {
    expect(shouldExclude("Troy")).toBe(false);
    expect(shouldExclude("City of Troy")).toBe(false);
    expect(shouldExclude("Boston")).toBe(false);
  });
});
