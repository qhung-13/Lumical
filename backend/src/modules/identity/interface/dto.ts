import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CredentialsDto {
  @ApiProperty({ type: String, format: 'email', maxLength: 254 }) email: string;
  @ApiProperty({ type: String, minLength: 12, maxLength: 128, writeOnly: true }) password: string;
}
export class PrincipalDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ type: String, format: 'email' }) email: string;
  @ApiProperty({ enum: ['USER', 'ADMIN'] }) role: 'USER' | 'ADMIN';
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) accountStatus: 'ACTIVE' | 'DISABLED';
}
export class AuthDataDto extends PrincipalDto {
  @ApiProperty({ type: String, description: 'Synchronizer token; browser memory only.' }) csrfToken: string;
}
export class AuthResponseDto { @ApiProperty({ type: AuthDataDto }) data: AuthDataDto; }
export class PrincipalResponseDto { @ApiProperty({ type: PrincipalDto }) data: PrincipalDto; }
export class SessionDataDto {
  @ApiProperty({ type: Boolean }) authenticated: boolean;
  @ApiPropertyOptional({ type: PrincipalDto }) principal?: PrincipalDto;
  @ApiPropertyOptional({ type: String }) csrfToken?: string;
}
export class SessionResponseDto { @ApiProperty({ type: SessionDataDto }) data: SessionDataDto; }
export class AccountStatusDto {
  @ApiProperty({ type: String, format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status: 'ACTIVE' | 'DISABLED';
  @ApiProperty({ type: Number, minimum: 1 }) version: number;
}
export class AccountStatusResponseDto { @ApiProperty({ type: AccountStatusDto }) data: AccountStatusDto; }
export class AccountStatusChangeDto {
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) status: 'ACTIVE' | 'DISABLED';
  @ApiProperty({ type: String, minLength: 1, maxLength: 1000 }) reason: string;
  @ApiPropertyOptional({ type: Boolean, default: false }) restoreEligibleShares?: boolean;
}
export class FieldErrorDto {
  @ApiProperty({ type: String }) path: string;
  @ApiProperty({ type: String }) code: string;
  @ApiProperty({ type: String }) messageKey: string;
}
export class ErrorDataDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 }) currentVersion?: number;
  @ApiProperty({ type: String }) code: string;
  @ApiProperty({ type: String }) messageKey: string;
  @ApiProperty({ type: String }) requestId: string;
  @ApiProperty({ type: Boolean }) retryable: boolean;
  @ApiProperty({ type: [FieldErrorDto] }) fieldErrors: FieldErrorDto[];
}
export class ErrorResponseDto { @ApiProperty({ type: ErrorDataDto }) error: ErrorDataDto; }
