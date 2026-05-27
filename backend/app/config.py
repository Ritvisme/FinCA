from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    MONGO_URI: str
    DB_NAME: str = "finca"

    # JWT
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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
