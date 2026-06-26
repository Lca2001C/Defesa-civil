import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetenciaStatus, FormularioStatus } from '@prisma/client';
import type { SchemaFormulario } from '@dcmg/contracts';
import { FormulariosRepository } from '../repositories/formularios.repository';
import type { PaginacaoDto } from '../../../common/dto/paginacao.dto';
import type { CriarFormularioDto } from '../dtos/criar-formulario.dto';
import type { AtualizarFormularioDto } from '../dtos/atualizar-formulario.dto';
import type { CriarVersaoDto } from '../dtos/criar-versao.dto';
import type { PublicarVersaoDto } from '../dtos/publicar-versao.dto';

@Injectable()
export class FormulariosService {
  constructor(private readonly repo: FormulariosRepository) {}

  // ──────────────────────────── Formulários ─────────────────────────────────

  criar(dto: CriarFormularioDto) {
    return this.repo.criarComSchema(
      { nome: dto.nome, descricao: dto.descricao, categoria: dto.categoria },
      dto.schema as unknown as SchemaFormulario | undefined,
    );
  }

  async buscarTodos(paginacao: PaginacaoDto, filtros: { status?: FormularioStatus }) {
    const pagina = paginacao.pagina ?? 1;
    const porPagina = paginacao.porPagina ?? 20;
    const { items, total } = await this.repo.listar(filtros, (pagina - 1) * porPagina, porPagina);
    return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
  }

  /** Metadados do formulário + resumo das versões (sem o schema composto). */
  async buscarPorId(id: string) {
    const form = await this.repo.buscarPorId(id);
    if (!form) throw new NotFoundException(`Formulário '${id}' não encontrado.`);
    return form;
  }

  async excluir(id: string): Promise<void> {
    if (!(await this.repo.existe(id))) {
      throw new NotFoundException('Formulário não encontrado.');
    }
    const totalSubmissoes = await this.repo.contarSubmissoesDoFormulario(id);
    if (totalSubmissoes > 0) {
      throw new BadRequestException(
        `Formulário possui ${totalSubmissoes} submissão(ões) vinculada(s) e não pode ser excluído.`,
      );
    }
    await this.repo.removerComVersoes(id);
  }

  async atualizar(id: string, dto: AtualizarFormularioDto) {
    await this.buscarPorId(id);
    return this.repo.atualizarMetadados(id, {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
      ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
    });
  }

  // ───────────────────────────── Versões ────────────────────────────────────

  listarVersoesPublicadas() {
    return this.repo.listarVersoesPublicadas();
  }

  /** Cria uma nova versão (rascunho) a partir de um schema. */
  async criarVersao(formularioId: string, dto: CriarVersaoDto) {
    if (!(await this.repo.existe(formularioId))) {
      throw new NotFoundException(`Formulário '${formularioId}' não encontrado.`);
    }
    const versaoId = await this.repo.criarVersaoComSchema(
      formularioId,
      dto.schema as unknown as SchemaFormulario,
    );
    return this.buscarVersao(formularioId, versaoId);
  }

  /** Retorna uma versão com o schema COMPOSTO (secoes→perguntas→opcoes→regras). */
  async buscarVersao(formularioId: string, versaoId: string) {
    const versao = await this.repo.buscarVersaoMeta(versaoId);
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }
    const schema = await this.repo.comporSchema(versaoId);
    schema.titulo = versao.formulario.nome;
    schema.descricao = versao.formulario.descricao ?? undefined;
    return {
      id: versao.id,
      versao: versao.versao,
      status: versao.status,
      publicadoEm: versao.publicadoEm,
      competenciaId: versao.competenciaId,
      competencia: versao.competencia,
      formulario: versao.formulario,
      schema,
    };
  }

  /**
   * Salva edições do construtor numa versão.
   * Versionamento automático/imutabilidade: uma versão PUBLICADA nunca é editada
   * in-place (a publicação — não a 1ª submissão — é o gatilho de imutabilidade),
   * pois já pode estar vinculada a uma competência ABERTA e visível aos
   * municípios. Nesse caso, cria-se uma nova versão (rascunho) com o schema
   * editado. Apenas versões RASCUNHO são editadas no lugar.
   */
  async salvarVersao(formularioId: string, versaoId: string, dto: CriarVersaoDto) {
    const versao = await this.repo.buscarVersaoComContagem(versaoId);
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }

    if (versao.status === FormularioStatus.PUBLICADO) {
      return this.criarVersao(formularioId, dto);
    }

    await this.repo.salvarSchema(versaoId, dto.schema as unknown as SchemaFormulario);
    return this.buscarVersao(formularioId, versaoId);
  }

  async publicarVersao(formularioId: string, versaoId: string, dto: PublicarVersaoDto) {
    const versao = await this.repo.buscarVersaoBasica(versaoId);
    if (!versao || versao.formularioId !== formularioId) {
      throw new NotFoundException(`Versão '${versaoId}' não encontrada neste formulário.`);
    }
    if (versao.status !== FormularioStatus.RASCUNHO) {
      throw new BadRequestException(
        `Apenas versões em RASCUNHO podem ser publicadas. Status atual: ${versao.status}.`,
      );
    }

    const competencia = await this.repo.buscarCompetencia(dto.competenciaId);
    if (!competencia) {
      throw new NotFoundException(`Competência '${dto.competenciaId}' não encontrada.`);
    }
    if (competencia.status !== CompetenciaStatus.ABERTA) {
      throw new BadRequestException(
        `A competência deve estar ABERTA para publicar. Status atual: ${competencia.status}.`,
      );
    }

    return this.repo.publicarVersao(formularioId, versaoId, dto.competenciaId);
  }

  // ──────────────────── Templates e blocos reutilizáveis ─────────────────────

  listarTemplates() {
    return this.repo.listarTemplates();
  }

  /** Cria um formulário (v1 rascunho) a partir de um template. */
  async criarDeTemplate(templateId: string) {
    const template = await this.repo.buscarTemplate(templateId);
    if (!template) throw new NotFoundException(`Template '${templateId}' não encontrado.`);

    const schema = template.schema as unknown as SchemaFormulario;
    return this.repo.criarComSchema(
      {
        nome: schema.titulo ?? template.nome,
        descricao: schema.descricao ?? template.descricao,
        categoria: template.categoria,
      },
      schema,
    );
  }

  listarBlocos() {
    return this.repo.listarBlocos();
  }

  // ─────────────────────── Compor schema (uso externo) ───────────────────────

  /** Exposto para o módulo de submissões compor o schema de uma versão. */
  comporSchema(versaoId: string): Promise<SchemaFormulario> {
    return this.repo.comporSchema(versaoId);
  }
}
