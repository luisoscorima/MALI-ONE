import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  OperationalServiceStatus,
  PortfolioArea,
  PortfolioImpact,
  PortfolioProjectType,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateOperationalServiceDto,
  CreatePortfolioProjectDto,
  ListProjectsQueryDto,
  ReorderProjectsDto,
  UpdateOperationalServiceDto,
  UpdatePortfolioProjectDto,
} from './dto/portfolio.dto';

const DEFAULT_PROJECT_STATUSES = [
  {
    key: 'backlog',
    name: 'Backlog',
    color: '#dc2626',
    isClosed: false,
    sortOrder: 0,
  },
  {
    key: 'planned',
    name: 'Planificado',
    color: '#dc2626',
    isClosed: false,
    sortOrder: 1,
  },
  {
    key: 'active',
    name: 'En ejecución',
    color: '#ca8a04',
    isClosed: false,
    sortOrder: 2,
  },
  {
    key: 'blocked',
    name: 'Bloqueado',
    color: '#9333ea',
    isClosed: false,
    sortOrder: 3,
  },
  {
    key: 'closed',
    name: 'Cerrado',
    color: '#16a34a',
    isClosed: true,
    sortOrder: 4,
  },
];

const AREAS: PortfolioArea[] = [
  PortfolioArea.infraestructura,
  PortfolioArea.aplicaciones,
  PortfolioArea.datos,
  PortfolioArea.seguridad,
  PortfolioArea.contenidos,
  PortfolioArea.otros,
];

const projectInclude = {
  status: true,
  owner: { select: { id: true, name: true, email: true } },
  tasks: {
    where: { archivedAt: null },
    select: {
      id: true,
      status: { select: { isDone: true } },
    },
  },
} as const;

@Injectable()
export class PortfolioService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureMeta();
  }

  async ensureMeta() {
    const existing = await this.prisma.portfolioProjectStatus.findMany();
    const byKey = new Map(existing.map((row) => [row.key, row]));
    for (const def of DEFAULT_PROJECT_STATUSES) {
      const current = byKey.get(def.key);
      if (!current) {
        await this.prisma.portfolioProjectStatus.create({ data: def });
      } else if (current.color !== def.color) {
        await this.prisma.portfolioProjectStatus.update({
          where: { id: current.id },
          data: { color: def.color },
        });
      }
    }
  }

  async getMeta() {
    await this.ensureMeta();
    const projectStatuses =
      await this.prisma.portfolioProjectStatus.findMany({
        orderBy: { sortOrder: 'asc' },
      });
    return {
      projectStatuses: projectStatuses.map(this.mapStatus),
      areas: AREAS,
    };
  }

  async list(user: User, query: ListProjectsQueryDto = {}) {
    const where: Prisma.PortfolioProjectWhereInput = {};

    if (user.role === UserRole.admin && query.ownerId) {
      where.ownerId = query.ownerId;
    } else if (user.role !== UserRole.admin) {
      where.ownerId = user.id;
    }

    if (query.statusId) where.statusId = query.statusId;
    if (query.area) where.area = query.area;

    if (query.includeArchived !== true) {
      where.archivedAt = null;
    }

    if (!query.statusId && query.includeClosed !== true) {
      where.status = { isClosed: false };
    }

    const projects = await this.prisma.portfolioProject.findMany({
      where,
      include: projectInclude,
      orderBy: [{ sortOrder: 'asc' }, { targetAt: 'asc' }, { createdAt: 'desc' }],
    });
    return projects.map((p) => this.mapProject(p));
  }

  async getOne(user: User, id: string) {
    const project = await this.findAccessible(user, id);
    return this.mapProject(project);
  }

  async create(user: User, dto: CreatePortfolioProjectDto) {
    let status = dto.statusId
      ? await this.assertStatus(dto.statusId)
      : await this.prisma.portfolioProjectStatus.findFirst({
          where: { key: 'backlog' },
          orderBy: { sortOrder: 'asc' },
        });
    if (!status) {
      throw new NotFoundException('No hay estados de proyecto configurados');
    }

    const sortOrder = await this.nextSortOrder(user.id, status.id);
    const project = await this.prisma.portfolioProject.create({
      data: {
        name: dto.name.trim(),
        detail: dto.detail?.trim() || null,
        statusId: status.id,
        area: dto.area ?? PortfolioArea.otros,
        projectType: dto.projectType ?? PortfolioProjectType.otro,
        stakeholder: dto.stakeholder?.trim() || null,
        impact: dto.impact ?? PortfolioImpact.medium,
        link: dto.link?.trim() || null,
        targetAt: dto.targetAt ? new Date(dto.targetAt) : null,
        ownerId: user.id,
        sortOrder,
      },
      include: projectInclude,
    });
    return this.mapProject(project);
  }

  async update(user: User, id: string, dto: UpdatePortfolioProjectDto) {
    const existing = await this.findAccessible(user, id);
    const nextStatus = dto.statusId
      ? await this.assertStatus(dto.statusId)
      : existing.status;

    const statusChanging =
      dto.statusId !== undefined && dto.statusId !== existing.statusId;

    let sortOrder = dto.sortOrder;
    if (statusChanging && sortOrder === undefined) {
      sortOrder = await this.nextSortOrder(existing.ownerId, nextStatus.id);
    }

    let archivedAt: Date | null | undefined;
    if (dto.archived === true) {
      archivedAt = existing.archivedAt ?? new Date();
    } else if (dto.archived === false) {
      archivedAt = null;
    }

    const project = await this.prisma.portfolioProject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.detail !== undefined
          ? { detail: dto.detail?.trim() || null }
          : {}),
        ...(dto.statusId !== undefined ? { statusId: dto.statusId } : {}),
        ...(dto.area !== undefined ? { area: dto.area } : {}),
        ...(dto.projectType !== undefined
          ? { projectType: dto.projectType }
          : {}),
        ...(dto.stakeholder !== undefined
          ? { stakeholder: dto.stakeholder?.trim() || null }
          : {}),
        ...(dto.impact !== undefined ? { impact: dto.impact } : {}),
        ...(dto.link !== undefined ? { link: dto.link?.trim() || null } : {}),
        ...(dto.targetAt !== undefined
          ? { targetAt: dto.targetAt ? new Date(dto.targetAt) : null }
          : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(archivedAt !== undefined ? { archivedAt } : {}),
      },
      include: projectInclude,
    });
    return this.mapProject(project);
  }

  async reorder(user: User, dto: ReorderProjectsDto) {
    await this.assertStatus(dto.statusId);
    if (dto.orderedIds.length === 0) return { ok: true };

    const items = await this.prisma.portfolioProject.findMany({
      where: { id: { in: dto.orderedIds } },
      select: { id: true, ownerId: true, statusId: true },
    });
    if (items.length !== dto.orderedIds.length) {
      throw new NotFoundException('Uno o más proyectos no existen');
    }
    for (const item of items) {
      if (user.role !== UserRole.admin && item.ownerId !== user.id) {
        throw new ForbiddenException('No tienes acceso a este proyecto');
      }
      if (item.statusId !== dto.statusId) {
        throw new ConflictException(
          'Todos los proyectos deben pertenecer al mismo estado',
        );
      }
    }

    await this.prisma.$transaction(
      dto.orderedIds.map((itemId, index) =>
        this.prisma.portfolioProject.update({
          where: { id: itemId },
          data: { sortOrder: index },
        }),
      ),
    );
    return { ok: true };
  }

  async remove(user: User, id: string) {
    await this.findAccessible(user, id);
    await this.prisma.portfolioProject.delete({ where: { id } });
    return { ok: true };
  }

  async dashboard(user: User, ownerId?: string) {
    const scopeOwner =
      user.role === UserRole.admin
        ? ownerId || undefined
        : user.id;

    const projectWhere: Prisma.PortfolioProjectWhereInput = {
      archivedAt: null,
      ...(scopeOwner ? { ownerId: scopeOwner } : {}),
    };

    const projects = await this.prisma.portfolioProject.findMany({
      where: projectWhere,
      include: { status: true },
    });

    const byKey = (key: string) =>
      projects.filter((p) => p.status.key === key).length;

    const areaCounts = new Map<PortfolioArea, number>();
    for (const p of projects) {
      if (p.status.isClosed) continue;
      areaCounts.set(p.area, (areaCounts.get(p.area) ?? 0) + 1);
    }
    const openCount = [...areaCounts.values()].reduce((a, b) => a + b, 0);
    const areaDistribution = AREAS.map((area) => {
      const count = areaCounts.get(area) ?? 0;
      return {
        area,
        count,
        percent: openCount === 0 ? 0 : Math.round((count / openCount) * 100),
      };
    }).filter((row) => row.count > 0);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const taskWhere: Prisma.TodoItemWhereInput = {
      archivedAt: null,
      ...(scopeOwner ? { ownerId: scopeOwner } : {}),
    };

    const completedThisWeek = await this.prisma.todoItem.findMany({
      where: {
        ...taskWhere,
        completedAt: { gte: weekStart },
        status: { isDone: true },
      },
      select: { title: true, timeSpentMinutes: true },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const weekTimeMinutes = completedThisWeek.reduce(
      (sum, t) => sum + t.timeSpentMinutes,
      0,
    );

    const upcomingProjects = await this.prisma.portfolioProject.findMany({
      where: {
        ...projectWhere,
        targetAt: { gte: weekStart },
        status: { isClosed: false },
      },
      orderBy: { targetAt: 'asc' },
      take: 8,
      select: { id: true, name: true, targetAt: true },
    });

    const upcomingTasks = await this.prisma.todoItem.findMany({
      where: {
        ...taskWhere,
        dueAt: { gte: weekStart },
        status: { isDone: false },
      },
      orderBy: { dueAt: 'asc' },
      take: 8,
      select: {
        id: true,
        title: true,
        dueAt: true,
        project: { select: { name: true } },
      },
    });

    const upcomingMilestones = [
      ...upcomingProjects
        .filter((p) => p.targetAt)
        .map((p) => ({
          kind: 'project' as const,
          id: p.id,
          title: p.name,
          at: p.targetAt!.toISOString(),
          projectName: null as string | null,
        })),
      ...upcomingTasks
        .filter((t) => t.dueAt)
        .map((t) => ({
          kind: 'task' as const,
          id: t.id,
          title: t.title,
          at: t.dueAt!.toISOString(),
          projectName: t.project?.name ?? null,
        })),
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 10);

    return {
      projectsActive: projects.filter((p) => !p.status.isClosed).length,
      projectsInProgress: byKey('active'),
      projectsPlanned: byKey('planned') + byKey('backlog'),
      projectsBlocked: byKey('blocked'),
      projectsClosed: byKey('closed'),
      areaDistribution,
      weekCompletedTasks: completedThisWeek.length,
      weekTimeMinutes,
      upcomingMilestones,
      weekCompletedTitles: completedThisWeek.slice(0, 8).map((t) => t.title),
    };
  }

  async listServices(user: User, ownerId?: string) {
    const where: Prisma.OperationalServiceWhereInput = {};
    if (user.role === UserRole.admin && ownerId) {
      where.ownerId = ownerId;
    } else if (user.role !== UserRole.admin) {
      where.ownerId = user.id;
    }

    const rows = await this.prisma.operationalService.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(this.mapService);
  }

  async createService(user: User, dto: CreateOperationalServiceDto) {
    const max = await this.prisma.operationalService.findFirst({
      where: { ownerId: user.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const row = await this.prisma.operationalService.create({
      data: {
        name: dto.name.trim(),
        status: dto.status ?? OperationalServiceStatus.up,
        notes: dto.notes?.trim() || null,
        sortOrder: dto.sortOrder ?? (max?.sortOrder ?? -1) + 1,
        ownerId: user.id,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    return this.mapService(row);
  }

  async updateService(
    user: User,
    id: string,
    dto: UpdateOperationalServiceDto,
  ) {
    await this.findAccessibleService(user, id);
    const row = await this.prisma.operationalService.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    return this.mapService(row);
  }

  async removeService(user: User, id: string) {
    await this.findAccessibleService(user, id);
    await this.prisma.operationalService.delete({ where: { id } });
    return { ok: true };
  }

  private async nextSortOrder(ownerId: string, statusId: string) {
    const last = await this.prisma.portfolioProject.findFirst({
      where: { ownerId, statusId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async findAccessible(user: User, id: string) {
    const project = await this.prisma.portfolioProject.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (user.role !== UserRole.admin && project.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a este proyecto');
    }
    return project;
  }

  private async findAccessibleService(user: User, id: string) {
    const row = await this.prisma.operationalService.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Servicio no encontrado');
    if (user.role !== UserRole.admin && row.ownerId !== user.id) {
      throw new ForbiddenException('No tienes acceso a este servicio');
    }
    return row;
  }

  private async assertStatus(id: string) {
    const row = await this.prisma.portfolioProjectStatus.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Estado de proyecto no encontrado');
    return row;
  }

  private mapStatus(row: {
    id: string;
    key: string;
    name: string;
    color: string | null;
    isClosed: boolean;
    sortOrder: number;
  }) {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      color: row.color,
      isClosed: row.isClosed,
      sortOrder: row.sortOrder,
    };
  }

  private mapProject(project: {
    id: string;
    name: string;
    detail: string | null;
    statusId: string;
    status: {
      id: string;
      key: string;
      name: string;
      color: string | null;
      isClosed: boolean;
      sortOrder: number;
    };
    area: PortfolioArea;
    projectType: PortfolioProjectType;
    stakeholder: string | null;
    impact: PortfolioImpact;
    link: string | null;
    targetAt: Date | null;
    ownerId: string;
    owner: { id: string; name: string; email: string };
    sortOrder: number;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    tasks: { id: string; status: { isDone: boolean } }[];
  }) {
    const taskTotal = project.tasks.length;
    const taskDone = project.tasks.filter((t) => t.status.isDone).length;
    const progress =
      taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);
    return {
      id: project.id,
      name: project.name,
      detail: project.detail,
      statusId: project.statusId,
      status: this.mapStatus(project.status),
      area: project.area,
      projectType: project.projectType,
      stakeholder: project.stakeholder,
      impact: project.impact,
      link: project.link,
      targetAt: project.targetAt?.toISOString() ?? null,
      ownerId: project.ownerId,
      ownerName: project.owner.name,
      ownerEmail: project.owner.email,
      sortOrder: project.sortOrder,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      progress,
      taskTotal,
      taskDone,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private mapService(row: {
    id: string;
    name: string;
    status: OperationalServiceStatus;
    notes: string | null;
    sortOrder: number;
    ownerId: string;
    owner: { id: string; name: string };
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      notes: row.notes,
      sortOrder: row.sortOrder,
      ownerId: row.ownerId,
      ownerName: row.owner.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
