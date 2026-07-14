from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    MONGO_URI: str
    DB_NAME: str = "finca"

    # JWT
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Environment: "dev" or "prod" — controls cookie secure/samesite flags
    ENVIRONMENT: str = "dev"

    # Comma-separated list of allowed frontend origins for CORS.
    # In prod set e.g. "https://finca.vercel.app"
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.ENVIRONMENT == "prod"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GROQ_API_KEY: str = ""
    # One-time secret to promote a user to admin. Set in .env, keep private.
    ADMIN_SETUP_SECRET: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # UploadThing
    UPLOADTHING_SECRET: str = ""
    UPLOADTHING_APP_ID: str = ""

    # App
    WEBHOOK_BASE_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
