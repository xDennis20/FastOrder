import os
from dotenv import load_dotenv

load_dotenv("./.env")

#Variable de entorno de database
DATABASE_URL = os.getenv("DATABASE_URL")