export type MemoryType = "interaction" | "learning" | "achievement" | "hobby";

export type Memory = {
  id: string;
  characterId: string;
  type: MemoryType;
  content: string;
  importance: string;
  metadata?: {
    userId?: string;
    sentiment?: string;
    topic?: string;
    hobby?: string;
    relatedMemories?: string[];
    [key: string]: any;
  };
  createdAt: Date;
};

export type CreateMemoryInput = Omit<Memory, "id" | "createdAt">;
