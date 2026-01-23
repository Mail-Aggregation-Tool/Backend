import { PartialType } from '@nestjs/swagger';
import { CreateEmailAccountDto } from './create-email-account.dto';

export class UpdateEmailAccountDto extends PartialType(
    CreateEmailAccountDto,
) { }
