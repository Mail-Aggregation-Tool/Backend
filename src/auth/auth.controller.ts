import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiExcludeEndpoint,
    ApiOkResponse,
    ApiCreatedResponse,
    ApiConflictResponse,
    ApiUnauthorizedResponse,
    ApiBadRequestResponse,
    ApiNotFoundResponse
} from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register a new user account',
        description: 'Creates a new user account with hashed password. Requires separate login after signup.'
    })
    @ApiBody({
        type: SignupDto,
        description: 'User registration details including name, email, and password'
    })
    @ApiCreatedResponse({
        description: 'User successfully registered',
        schema: {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        email: { type: 'string', example: 'user@example.com' },
                        name: { type: 'string', example: 'John Doe' },
                        createdAt: { type: 'string', format: 'date-time', example: '2026-01-25T15:30:00Z' },
                        updatedAt: { type: 'string', format: 'date-time', example: '2026-01-25T15:30:00Z' }
                    }
                },
                message: { type: 'string', example: 'User registered successfully!' }
            }
        }
    })
    @ApiConflictResponse({
        description: 'User with this email already exists',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: { type: 'string', example: 'User already exists' },
                error: { type: 'string', example: 'Conflict' }
            }
        }
    })
    @ApiBadRequestResponse({
        description: 'Validation failed - invalid input data',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'array', items: { type: 'string' }, example: ['email must be a valid email', 'password must be at least 6 characters'] },
                error: { type: 'string', example: 'Bad Request' }
            }
        }
    })
    async signup(@Body() signupDto: SignupDto) {
        return this.authService.signup(signupDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Login with email and password',
        description: 'Authenticates user credentials and returns JWT token with user data. OAuth users must use OAuth login endpoints.'
    })
    @ApiBody({
        type: LoginDto,
        description: 'User login credentials'
    })
    @ApiOkResponse({
        description: 'Successfully authenticated',
        schema: {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        email: { type: 'string', example: 'user@example.com' },
                        name: { type: 'string', example: 'John Doe' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                token: {
                    type: 'string',
                    description: 'JWT access token for subsequent authenticated requests',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                }
            }
        }
    })
    @ApiUnauthorizedResponse({
        description: 'Invalid credentials or OAuth user attempting password login',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: {
                    type: 'string',
                    oneOf: [
                        { example: 'Invalid credentials' },
                        { example: 'Please login with your OAuth provider' }
                    ]
                },
                error: { type: 'string', example: 'Unauthorized' }
            }
        }
    })
    @ApiBadRequestResponse({
        description: 'Validation failed - invalid email or password format'
    })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('microsoft')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({
        summary: 'Initiate Microsoft OAuth authentication',
        description: 'Redirects to Microsoft OAuth login page. Used for signup or login via Microsoft account.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to Microsoft OAuth authorization URL'
    })
    @ApiExcludeEndpoint(false)
    async microsoftAuth() {
        // Guard handles the redirect to Microsoft OAuth
    }

    @Get('microsoft/callback')
    @UseGuards(AuthGuard('microsoft'))
    @ApiOperation({
        summary: 'Microsoft OAuth callback handler',
        description: 'Processes Microsoft OAuth callback, creates/updates user account, and redirects to frontend with JWT token.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to frontend application with authentication token and user data in query parameters',
        schema: {
            type: 'object',
            properties: {
                redirectUrl: {
                    type: 'string',
                    example: 'http://localhost:3000/auth/microsoft/callback?token=eyJhbGci...&user=%7B%22id%22%3A%22...',
                    description: 'Frontend URL with token and encoded user object'
                }
            }
        }
    })
    @ApiExcludeEndpoint(false)
    async microsoftAuthRedirect(@Req() req, @Res() res) {
        const authResult = await this.authService.microsoftAuth(req.user);
        const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/auth/microsoft/callback?token=${authResult.token}&user=${encodeURIComponent(JSON.stringify(authResult.user))}`);
    }

    @Get('microsoft/outlook')
    @UseGuards(AuthGuard('microsoft-outlook'))
    @ApiOperation({
        summary: 'Connect Microsoft Outlook email account',
        description: 'Initiates OAuth flow to connect Outlook account for email synchronization. User must be logged in.'
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to Microsoft OAuth authorization URL with Outlook email scopes'
    })
    @ApiExcludeEndpoint(false)
    async microsoftOutlookAuth() {
        // Guard handles the redirect to Microsoft OAuth with email scopes
    }

    @Get('microsoft/outlook/callback')
    @UseGuards(AuthGuard('microsoft-outlook'))
    @ApiOperation({
        summary: 'Microsoft Outlook OAuth callback handler',
        description: 'Processes Outlook OAuth callback, links account to user, stores tokens, queues email sync, and redirects to frontend.'
    })
    @ApiNotFoundResponse({
        description: 'User not found - must sign up first before connecting Outlook',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'User not found. Please sign up first.' },
                error: { type: 'string', example: 'Not Found' }
            }
        }
    })
    @ApiResponse({
        status: 302,
        description: 'Redirects to frontend newsletter generator with email account token',
        schema: {
            type: 'object',
            properties: {
                redirectUrl: {
                    type: 'string',
                    example: 'http://localhost:3000/newsletter-generator?token=eyJhbGci...',
                    description: 'Frontend URL with the connected email account information'
                }
            }
        }
    })
    @ApiExcludeEndpoint(false)
    async microsoftOutlookAuthRedirect(@Req() req, @Res() res) {
        // We assume the user is connecting an account with the SAME email, 
        // or we rely on finding the user by the OAuth email.
        // Ideally we would pass state to link different emails.
        const token = await this.authService.connectOutlook(req.user);
        const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/newsletter-generator?token=${token}`);
    }
}
