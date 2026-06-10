import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../../common/decorators/publico.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TokensDto } from './dto/tokens.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica o usuário e retorna os tokens JWT.' })
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.auth.login(dto.email, dto.senha);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova o access token usando o refresh token.' })
  refresh(@Body() dto: RefreshDto): Promise<TokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalida a sessão (revoga o refresh token no Redis).' })
  async logout(@UsuarioAtual() usuario: JwtPayload): Promise<void> {
    await this.auth.logout(usuario.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado (extraídos do JWT).' })
  me(@UsuarioAtual() usuario: JwtPayload): JwtPayload {
    return usuario;
  }
}
