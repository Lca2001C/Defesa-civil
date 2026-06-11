import {
  Body,
  Controller,
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
import { Permissao } from '../../common/decorators/permissao.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { UsuariosService } from './usuarios.service';

@ApiBearerAuth()
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

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
