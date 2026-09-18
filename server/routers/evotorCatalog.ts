import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getOperationalEvotorMapping, listEvotorCatalogPreviewForOperationalStore } from "../evotorCatalog";

export const evotorCatalogRouter = router({
  mappingForStore: adminProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => getOperationalEvotorMapping(input.storeId)),
  previewForStore: adminProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => listEvotorCatalogPreviewForOperationalStore(input.storeId)),
});
