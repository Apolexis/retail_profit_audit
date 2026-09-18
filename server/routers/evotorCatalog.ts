import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { listEvotorCatalogPreview, listEvotorCatalogStoresPreview } from "../evotorCatalog";

export const evotorCatalogRouter = router({
  stores: adminProcedure.query(async () => listEvotorCatalogStoresPreview()),
  preview: adminProcedure.input(z.object({ storeId: z.string().trim().min(1).max(128) })).query(async ({ input }) => listEvotorCatalogPreview(input.storeId)),
});
