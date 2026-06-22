import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permissao } from '../../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { AtualizarMeDto } from '../dtos/atualizar-me.dto';
import { AtualizarUsuarioDto } from '../dtos/atualizar-usuario.dto';
import { CriarUsuarioDto } from '../dtos/criar-usuario.dto';
import { RedefinirSenhaDto } from '../dtos/redefinir-senha.dto';
import { UsuariosService } from '../services/usuarios.service';

@ApiBearerAuth()
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  /** Dados do próprio usuário autenticado (para tela de perfil). */
  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados completos do usuário autenticado.' })
  me(@UsuarioAtual() usuario: JwtPayload) {
    return this.service.buscarMe(usuario.sub);
  }

  /** Atualiza nome, cargo e telefone do próprio usuário. */
  @Patch('me')
  @ApiOperation({ summary: 'Atualiza dados pessoais do usuário autenticado.' })
  atualizarMe(@Body() dto: AtualizarMeDto, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.atualizarMe(usuario.sub, dto);
  }

  /** LGPD art. 18 — o titular consulta todos os seus dados pessoais. */
  @Get('meus-dados')
  @ApiOperation({ summary: 'Exportação LGPD: dados pessoais do usuário autenticado.' })
  meusDados(@UsuarioAtual() usuario: JwtPayload) {
    return this.service.buscarMeusDados(usuario.sub);
  }

  @Post()
  @Permissao('usuarios.gerenciar')
  @ApiOperation({ summary: 'Cria um novo usuário.' })
  criar(@Body() dto: CriarUsuarioDto, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.criar(dto, usuario);
  }

  @Get()
  @Permissao('usuarios.gerenciar')
  @ApiOperation({ summary: 'Lista usuários com filtros opcionais.' })
  @ApiQuery({ name: 'municipioId', required: false, type: Number })
  @ApiQuery({ name: 'regionalId', required: false })
  @ApiQuery({ name: 'ativo', required: false, type: Boolean })
  listar(
    @Query('municipioId') municipioId?: string,
    @Query('regionalId') regionalId?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.service.listar({
      municipioId: municipioId ? Number(municipioId) : undefined,
      regionalId,
      ativo: ativo !== undefined ? ativo === 'true' : undefined,
    });
  }

  @Get(':id')
  @Permissao('usuarios.gerenciar')
  @ApiOperation({ summary: 'Retorna um usuário pelo ID.' })
  buscarPorId(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.buscarPorId(id, usuario);
  }

  @Patch(':id')
  @Permissao('usuarios.gerenciar')
  @ApiOperation({ summary: 'Atualiza nome, cargo, telefone ou perfil.' })
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.atualizar(id, dto, usuario);
  }

  @Patch(':id/ativar')
  @Permissao('usuarios.gerenciar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa um usuário desativado.' })
  ativar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.ativar(id, usuario);
  }

  @Patch(':id/desativar')
  @Permissao('usuarios.gerenciar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativa um usuário.' })
  desativar(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.desativar(id, usuario);
  }

  @Delete(':id')
  @Permissao('usuarios.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui permanentemente um usuário.' })
  excluir(@Param('id') id: string, @UsuarioAtual() usuario: JwtPayload) {
    return this.service.excluir(id, usuario);
  }

  @Patch(':id/senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefine a senha (próprio usuário ou SUPER_ADMIN).' })
  redefinirSenha(
    @Param('id') id: string,
    @Body() dto: RedefinirSenhaDto,
    @UsuarioAtual() usuario: JwtPayload,
  ) {
    return this.service.redefinirSenha(id, dto.novaSenha, usuario);
  }
}
