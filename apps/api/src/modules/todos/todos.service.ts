import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TodoEffort,
  TodoPriority,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  AddTodoTimeDto,
  CreateTodoItemDto,
  CreateTodoStatusDto,
  CreateTodoTypeDto,
  UpdateTodoItemDto,
  UpdateTodoStatusDto,
  UpdateTodoTypeDto,
} from './dto/todos.dto';

const DEFAULT_TYPES = [
  { name: 'General', color: '#64748b', sortOrder: 0 },
  { name: 'Operaciones', color: '#2563eb', sortOrder: 1 },
  { name: 'Contenido', color: '#7c3aed', sortOrder: 2 },
  { name: 'Sistemas', color: '#059669', sortOrder: 3 },
];

const DEFAULT_STATUSES = [
  {
    key: 'pending',
    name: 'Pendiente',
    color: '#94a3b8',
    isDone: false,
    sortOrder: 0,
  },
  {
    key: 'doing',
    name: 'En curso',
    color: '#3b82f6',
    isDone: false,
    sortOrder: 1,
  },
  {
    key: 'blocked',
    name: 'Bloqueado',
    color: '#f59e0b',
    isDone: false,
    sortOrder: 2,
  },
  {
    key: 'done',
    name: 'Hecho',
    color: '#22c55e',
    isDone: true,
    sortOrder: 3,
  },
];

const itemInclude = {
  type: true,
  status: true,
  owner: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureMeta() {
    await this.ensureDefaultTypes();
    await this.ensureDefaultStatuses();
  }

  private async ensureDefaultTypes() {
    const existing = await this.prisma.todoType.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const keepers = new Map<string, string>();
    for (const row of existing) {
      const key = row.name.trim().toLowerCase();
      const keeperId = keepers.get(key);
      if (!keeperId) {
        keepers.set(key, row.id);
        continue;
      }
      await this.prisma.$transaction([
        this.prisma.todoItem.updateMany({
          where: { typeId: row.id },
          data: { typeId: keeperId },
        }),
        this.prisma.todoType.delete({ where: { id: row.id } }),
      ]);
    }
    for (const def of DEFAULT_TYPES) {
      if (!keepers.has(def.name.toLowerCase())) {
        const created = await this.prisma.todoType.create({ data: def });
        keepers.set(def.name.toLowerCase(), created.id);
      }
    }
  }

  private async ensureDefaultStatuses() {
    const existing = await this.prisma.todoStatus.findMany();
    const byKey = new Set(existing.map((row) => row.key));
    for (const def of DEFAULT_STATUSES) {
      if (!byKey.has(def.key)) {
        await this.prisma.todoStatus.create({ data: def });
        byKey.add(def.key);
      }
    }
  }

  async getMeta() {
    await this.ensureMeta();
    const [types, statuses] = await Promise.all([
      this.prisma.todoType.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.todoStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);
    return {
      types: types.map(this.mapType),
      statuses: statuses.map(this.mapStatus),
    };
  }

  async list(user: User, ownerId?: string) {
    await this.ensureMeta();
    const where =
      user.role === UserRole.admin && ownerId
        ? { ownerId }
        : user.role === UserRole.admin && !ownerId
          ? {}
          : { ownerId: user.id };

    const items = await this.prisma.todoItem.findMany({
      where,
      include: itemInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map((item) => this.mapItem(item));
  }

  async getOne(user: User, id: string) {
    const item = await this.findAccessible(user, id);
    return this.mapItem(item);
  }

  async create(user: User, dto: CreateTodoItemDto) {
    await this.ensureMeta();
    let statusId = dto.statusId;
    if (!statusId) {
      const pending = await this.prisma.todoStatus.findFirst({
        where: { key: 'pending' },
        orderBy: { sortOrder: 'asc' },
      });
      if (!pending) {
        throw new NotFoundException('No hay estados configurados');
      }
      statusId = pending.id;
    } else {
      await this.assertStatus(statusId);
    }
    if (dto.typeId) await this.assertType(dto.typeId);

    const item = await this.prisma.todoItem.create({
      data: {
        title: dto.title.trim(),
        detail: dto.detail?.trim() || null,
        typeId: dto.typeId ?? null,
        priority: dto.priority ?? TodoPriority.medium,
        effort: dto.effort ?? null,
        statusId,
        ownerId: user.id,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: itemInclude,
    });
    return this.mapItem(item);
  }

  async update(user: User, id: string, dto: UpdateTodoItemDto) {
    const existing = await this.findAccessible(user, id);
    if (dto.statusId) await this.assertStatus(dto.statusId);
    if (dto.typeId) await this.assertType(dto.typeId);

    const statusChanging =
      dto.statusId !== undefined && dto.statusId !== existing.statusId;

    const item = await this.prisma.todoItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.detail !== undefined
          ? { detail: dto.detail?.trim() || null }
          : {}),
        ...(dto.typeId !== undefined ? { typeId: dto.typeId } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.effort !== undefined ? { effort: dto.effort } : {}),
        ...(dto.statusId !== undefined ? { statusId: dto.statusId } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(statusChanging ? { statusChangedAt: new Date() } : {}),
      },
      include: itemInclude,
    });
    return this.mapItem(item);
  }

  async addTime(user: User, id: string, dto: AddTodoTimeDto) {
    await this.findAccessible(user, id);
    const item = await this.prisma.todoItem.update({
      where: { id },
      data: { timeSpentMinutes: { increment: dto.minutes } },
      include: itemInclude,
    });
    return this.mapItem(item);
  }

  async remove(user: User, id: string) {
    await this.findAccessible(user, id);
    await this.prisma.todoItem.delete({ where: { id } });
    return { ok: true };
  }

  async createType(dto: CreateTodoTypeDto) {
    const name = dto.name.trim();
    await this.assertTypeNameAvailable(name);
    const row = await this.prisma.todoType.create({
      data: {
        name,
        color: dto.color ?? null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.mapType(row);
  }

  async updateType(id: string, dto: UpdateTodoTypeDto) {
    await this.assertType(id);
    const name = dto.name !== undefined ? dto.name.trim() : undefined;
    if (name) await this.assertTypeNameAvailable(name, id);
    const row = await this.prisma.todoType.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.mapType(row);
  }

  async createStatus(dto: CreateTodoStatusDto) {
    const row = await this.prisma.todoStatus.create({
      data: {
        key: dto.key.trim().toLowerCase().replace(/\s+/g, '_'),
        name: dto.name.trim(),
        color: dto.color ?? null,
        isDone: dto.isDone ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.mapStatus(row);
  }

  async updateStatus(id: string, dto: UpdateTodoStatusDto) {
    await this.assertStatus(id);
    const row = await this.prisma.todoStatus.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.mapStatus(row);
  }

  private async findAccessible(user: User, id: string) {
    const item = await this.prisma.todoItem.findUnique({
      where: { id },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException('Tarea no encontrada');
    if (user.role !== UserRole.admin && item.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta tarea');
    }
    return item;
  }

  private async assertTypeNameAvailable(name: string, excludeId?: string) {
    const row = await this.prisma.todoType.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (row) throw new ConflictException('Ya existe un tipo con ese nombre');
  }

  private async assertType(id: string) {
    const row = await this.prisma.todoType.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Tipo no encontrado');
    return row;
  }

  private async assertStatus(id: string) {
    const row = await this.prisma.todoStatus.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Estado no encontrado');
    return row;
  }

  private mapType(row: {
    id: string;
    name: string;
    color: string | null;
    active: boolean;
    sortOrder: number;
  }) {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      active: row.active,
      sortOrder: row.sortOrder,
    };
  }

  private mapStatus(row: {
    id: string;
    key: string;
    name: string;
    color: string | null;
    isDone: boolean;
    sortOrder: number;
  }) {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      color: row.color,
      isDone: row.isDone,
      sortOrder: row.sortOrder,
    };
  }

  private mapItem(item: {
    id: string;
    title: string;
    detail: string | null;
    typeId: string | null;
    type: {
      id: string;
      name: string;
      color: string | null;
      active: boolean;
      sortOrder: number;
    } | null;
    priority: TodoPriority;
    effort: TodoEffort | null;
    statusId: string;
    status: {
      id: string;
      key: string;
      name: string;
      color: string | null;
      isDone: boolean;
      sortOrder: number;
    };
    ownerId: string;
    owner: { id: string; name: string; email: string };
    registeredAt: Date;
    dueAt: Date | null;
    statusChangedAt: Date;
    timeSpentMinutes: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      title: item.title,
      detail: item.detail,
      typeId: item.typeId,
      type: item.type ? this.mapType(item.type) : null,
      priority: item.priority,
      effort: item.effort,
      statusId: item.statusId,
      status: this.mapStatus(item.status),
      ownerId: item.ownerId,
      ownerName: item.owner.name,
      ownerEmail: item.owner.email,
      registeredAt: item.registeredAt.toISOString(),
      dueAt: item.dueAt?.toISOString() ?? null,
      statusChangedAt: item.statusChangedAt.toISOString(),
      timeSpentMinutes: item.timeSpentMinutes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
