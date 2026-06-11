import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Publico } from '../../common/decorators/publico.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegistrarDto } from './dto/registrar.dto';
import {
  RedefinirSenhaComTokenDto,
  SolicitarRecuperacaoDto,
} from './dto/recuperar-senha.dto';

function extrairIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com e-mail + senha. Retorna access + refresh tokens.' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.senha);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca refresh token por novo par de tokens.' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalida a sessão atual (revoga refresh token).' })
  logout(@UsuarioAtual() usuario: JwtPayload) {
    return this.auth.logout(usuario.sub);
  }

  @Post('logout-global')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalida todas as sessões do usuário.' })
  logoutGlobal(@UsuarioAtual() usuario: JwtPayload) {
    return this.auth.logout(usuario.sub);
  }

  @Publico()
  @Post('registrar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Auto-cadastro público. Cria conta como OPERADOR_MUNICIPAL.' })
  registrar(@Body() dto: RegistrarDto, @Req() req: Request) {
    return this.auth.registrar(dto, extrairIp(req), req.headers['user-agent']);
  }

  @Publico()
  @Get('termos-lgpd/atual')
  @ApiOperation({ summary: 'Retorna o texto e a versão do Termo LGPD vigente.' })
  buscarTermoAtual() {
    return this.auth.buscarTermoAtual();
  }

  @Publico()
  @Post('recuperar-senha/solicitar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Envia link de redefinição de senha por e-mail.' })
  solicitarRecuperacao(@Body() dto: SolicitarRecuperacaoDto) {
    return this.auth.solicitarRecuperacaoSenha(dto);
  }

  @Publico()
  @Post('recuperar-senha/redefinir')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aplica nova senha usando o token enviado por e-mail.' })
  redefinirSenha(@Body() dto: RedefinirSenhaComTokenDto) {
    return this.auth.redefinirSenhaComToken(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o payload JWT do usuário autenticado.' })
  me(@UsuarioAtual() usuario: JwtPayload) {
    return usuario;
  }
}
