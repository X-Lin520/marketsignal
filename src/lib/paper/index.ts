import { prisma } from "@/lib/db/prisma";
import { createPaperService } from "./service";

export const paper = createPaperService(prisma);
