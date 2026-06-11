import { readJsonFile, writeJsonFile, generateId } from './file.js';
import { logger, logOperation } from './logger.js';
import type { BaseEntity, PaginationParams, ApiResponse } from '../types/index.js';

export function buildQueryFilter<T>(query: Record<string, unknown>, fuzzyFields: string[] = []): (item: T) => boolean {
  return (item: T): boolean => {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (key === 'page' || key === 'pageSize') continue;

      const itemValue = (item as Record<string, unknown>)[key];

      if (fuzzyFields.includes(key) && typeof value === 'string' && typeof itemValue === 'string') {
        if (!itemValue.includes(value)) return false;
      } else {
        if (itemValue !== value) return false;
      }
    }
    return true;
  };
}

export function paginate<T>(
  data: T[],
  pagination: PaginationParams
): { data: T[]; total: number; page: number; pageSize: number } {
  const page = pagination.page || 1;
  const pageSize = pagination.pageSize || 20;
  const total = data.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedData = data.slice(start, end);

  return {
    data: paginatedData,
    total,
    page,
    pageSize,
  };
}

export interface CrudOptions<T extends BaseEntity> {
  filename: string;
  idPrefix: string;
  moduleName: string;
}

export class CrudService<T extends BaseEntity> {
  private filename: string;
  private idPrefix: string;
  private moduleName: string;

  constructor(options: CrudOptions<T>) {
    this.filename = options.filename;
    this.idPrefix = options.idPrefix;
    this.moduleName = options.moduleName;
  }

  private read(): T[] {
    return readJsonFile<T[]>(this.filename) || [];
  }

  private write(data: T[]): void {
    writeJsonFile(this.filename, data);
  }

  async create(data: Omit<T, keyof BaseEntity>, userId?: string): Promise<T> {
    const items = this.read();
    const now = new Date().toISOString();
    const newItem: T = {
      ...data,
      id: generateId(this.idPrefix),
      createdAt: now,
      updatedAt: now,
    } as T;

    items.push(newItem);
    this.write(items);

    logOperation(this.moduleName, 'create', userId, { id: newItem.id, data });
    logger.info(this.moduleName, `创建${this.moduleName}记录`, { id: newItem.id });

    return newItem;
  }

  async getById(id: string): Promise<T | undefined> {
    const items = this.read();
    return items.find(item => item.id === id);
  }

  async list(
    filters: Record<string, unknown> = {},
    fuzzyFields: string[] = [],
    pagination: PaginationParams = {}
  ): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
    let items = this.read();
    const filterFn = buildQueryFilter<T>(filters, fuzzyFields);
    items = items.filter(filterFn);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return paginate(items, pagination);
  }

  async update(id: string, data: Partial<T>, userId?: string): Promise<T | undefined> {
    const items = this.read();
    const index = items.findIndex(item => item.id === id);

    if (index === -1) {
      logger.warn(this.moduleName, `${this.moduleName}记录不存在`, { id });
      return undefined;
    }

    const updated: T = {
      ...items[index],
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    this.write(items);

    logOperation(this.moduleName, 'update', userId, { id, data });
    logger.info(this.moduleName, `更新${this.moduleName}记录`, { id });

    return updated;
  }

  async remove(id: string, userId?: string): Promise<boolean> {
    const items = this.read();
    const filtered = items.filter(item => item.id !== id);

    if (filtered.length === items.length) {
      return false;
    }

    this.write(filtered);
    logOperation(this.moduleName, 'delete', userId, { id });
    logger.info(this.moduleName, `删除${this.moduleName}记录`, { id });
    return true;
  }

  async archive(id: string, userId?: string): Promise<T | undefined> {
    return this.update(id, { status: 'archived' } as unknown as Partial<T>, userId);
  }
}

export function successResponse<T>(
  data: T,
  pagination?: { total: number; page: number; pageSize: number }
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(pagination || {}),
  };
}

export function errorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
  };
}
