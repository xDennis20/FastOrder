import cloudinary.uploader
from enum import Enum
from cloudinary.exceptions import Error as CloudinaryError
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends, Query
from app.api.deps import VerificarRol
from app.api.v1.auth.schemas import TokenData
from app.models.usuario import RolesValidos

router = APIRouter(prefix="/upload", tags=["upload"])

MAX_FILE_SIZE = 5 * 1024 * 1024

class TipoRecurso(str, Enum):
    PLATOS = "platos"
    LOGOS = "logos"

@router.post("/file")
def create_file(file: UploadFile = File(...),
                tipo: TipoRecurso = Query(default=TipoRecurso.PLATOS),
                current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO]))):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no permitido")

    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Imagen demasiado grande. El maximo permitido es 5MB"
        )

    try:
        resultado = cloudinary.uploader.upload(
            file.file,
            folder=f"restaurantes/{current_user.restaurante_id}/{tipo.value}"
        )
        url_imagen = resultado.get("secure_url")

        return {"img_url": url_imagen}

    except CloudinaryError as e:
        print(f"Error de Cloudinary: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error al subir la imagen al servidor de almacenamiento"
        )

    except Exception as e:
        print(f"Error inesperado en subida: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ocurrió un error inesperado al procesar el archivo"
        )
