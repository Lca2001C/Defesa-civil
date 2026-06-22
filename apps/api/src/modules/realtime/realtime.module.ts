import { Module } from '@nestjs/common';
import { RealtimeGateway } from './gateways/realtime.gateway';
import { AuthModule } from '../auth/auth.module';
import { PainelModule } from '../painel/painel.module';

@Module({
  imports: [AuthModule, PainelModule], // JwtService + PainelService no gateway
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
