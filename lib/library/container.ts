import { createInMemoryLibraryRepository } from "@/lib/library/repository";
import { UserLibraryService } from "@/lib/library/service";

let service = new UserLibraryService(createInMemoryLibraryRepository());

export function getUserLibraryService() {
  return service;
}

export function resetUserLibraryServiceForTests() {
  service = new UserLibraryService(createInMemoryLibraryRepository());
}
