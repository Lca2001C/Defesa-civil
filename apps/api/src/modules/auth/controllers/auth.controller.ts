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
import { Publico } from '../../../common/decorators/publico.decorator';
import { UsuarioAtual } from '../../../common/decorators/usuario-atual.decorator';
import { extrairIp } from '../../../shared/utils/format.util';
import type { JwtPayload } from '../../../common/types/jwt-payload';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { RefreshDto } from '../dtos/refresh.dto';
import { RegistrarDto } from '../dtos/registrar.dto';
import {
  RedefinirSenhaComTokenDto,
  SolicitarRecuperacaoDto,
} from '../dtos/recuperar-senha.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com e-mail + senha. Retorna access + refresh tokens.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.senha, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
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
  logout(@UsuarioAtual() usuario: JwtPayload, @Req() req: Request) {
    return this.auth.logout(usuario.sub, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout-global')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalida todas as sessões do usuário.' })
  logoutGlobal(@UsuarioAtual() usuario: JwtPayload, @Req() req: Request) {
    return this.auth.logout(usuario.sub, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
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
  solicitarRecuperacao(@Body() dto: SolicitarRecuperacaoDto, @Req() req: Request) {
    return this.auth.solicitarRecuperacaoSenha(dto, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Publico()
  @Post('recuperar-senha/redefinir')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aplica nova senha usando o token enviado por e-mail.' })
  redefinirSenha(@Body() dto: RedefinirSenhaComTokenDto, @Req() req: Request) {
    return this.auth.redefinirSenhaComToken(dto, {
      ip: extrairIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna o payload JWT do usuário autenticado.' })
  me(@UsuarioAtual() usuario: JwtPayload) {
    return usuario;
  }
}
