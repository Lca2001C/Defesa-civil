import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import type { AtualizarCompdecDto } from '../dtos/atualizar-compdec.dto';
import { LocalidadesRepository } from '../repositories/localidades.repository';

const CACHE_MUNICIPIOS_MG = 'municipios:lista:mg';
const CACHE_TTL_SEG = 3600;

@Injectable()
export class LocalidadesService {
  constructor(
    private readonly repo: LocalidadesRepository,
    private readonly redis: RedisService,
  ) {}

  // ── Municípios ─────────────────────────────────────────────────────────────

  /**
   * Lista enxuta de TODOS os municípios de MG (id = código IBGE + nome).
   * Usada no seletor de município ao criar submissão. Cacheada (muda raramente).
   */
  async listarTodosMunicipios(): Promise<{ id: number; nome: string }[]> {
    const cacheado = await this.redis.cacheGet<{ id: number; nome: string }[]>(CACHE_MUNICIPIOS_MG);
    if (cacheado) return cacheado;

    const municipios = await this.repo.listarTodosMunicipiosMg();
    await this.redis.cacheSet(CACHE_MUNICIPIOS_MG, municipios, CACHE_TTL_SEG);
    return municipios;
  }

  async listarMunicipios(
    paginacao: PaginacaoDto,
    filtros: { nome?: string; regionalId?: string; ufId?: number },
    usuario: JwtPayload,
  ) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const { items, total } = await this.repo.listarMunicipios(
      filtros,
      { escopo: usuario.escopo, municipioId: usuario.municipioId, regionalId: usuario.regionalId },
      (pagina - 1) * porPagina,
      porPagina,
    );
    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  async buscarMunicipioPorId(id: number, usuario: JwtPayload) {
    this.verificarEscopoMunicipio(id, usuario);
    const municipio = await this.repo.buscarMunicipioPorId(id);
    if (!municipio) throw new NotFoundException('Município não encontrado.');
    return municipio;
  }

  async atualizarCompdec(municipioId: number, dto: AtualizarCompdecDto, usuario: JwtPayload) {
    // Apenas ADMIN_MUNICIPAL do próprio município ou perfis estaduais
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId !== municipioId) {
      throw new ForbiddenException('Você só pode atualizar dados do seu próprio município.');
    }

    if (!(await this.repo.municipioExiste(municipioId))) {
      throw new NotFoundException('Município não encontrado.');
    }

    return this.repo.upsertCompdec(municipioId, dto);
  }

  // ── Regionais ──────────────────────────────────────────────────────────────

  listarRegionais(ufId?: number) {
    return this.repo.listarRegionais(ufId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private verificarEscopoMunicipio(municipioId: number, usuario: JwtPayload): void {
    if (usuario.escopo === 'MUNICIPAL' && usuario.municipioId !== municipioId) {
      throw new ForbiddenException('Acesso negado a este município.');
    }
  }
}
