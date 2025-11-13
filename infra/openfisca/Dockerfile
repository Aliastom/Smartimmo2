# ============================================================================
# Dockerfile OpenFisca-France — SmartImmo (version personnalisée)
# ============================================================================
#
# Image Docker légère pour OpenFisca-France, sans dépendances inutiles.
# 
# BUILD AVEC VERSION ÉPINGLÉE (recommandé production) :
#   docker build \
#     --build-arg OPENFISCA_FRANCE_VERSION=174.2.8 \
#     -t <USER>/openfisca-france:stable \
#     -t <USER>/openfisca-france:2025-11-08 \
#     .
#
# BUILD AVEC DERNIÈRES VERSIONS :
#   docker build \
#     -t <USER>/openfisca-france:stable \
#     -t <USER>/openfisca-france:$(date +%Y-%m-%d) \
#     .
#
# PUSH VERS DOCKER HUB :
#   docker push <USER>/openfisca-france:stable
#   docker push <USER>/openfisca-france:2025-11-08
#
# ============================================================================

# Base image Python légère (Debian slim)
FROM python:3.11-slim

# Metadata
LABEL maintainer="SmartImmo <admin@smartimmo.fr>"
LABEL description="OpenFisca-France API for SmartImmo - Custom build"
LABEL org.opencontainers.image.source="https://github.com/votre-org/smartimmo"

# Argument de build (version épingable)
# Si non spécifié, installe la dernière version disponible
ARG OPENFISCA_FRANCE_VERSION=""

# Variables d'environnement
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r openfisca && \
    useradd -r -g openfisca -d /app -s /sbin/nologin openfisca

# Répertoire de travail
WORKDIR /app

# Installer les dépendances système minimales
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Installer OpenFisca-France (inclut OpenFisca-Core avec Web API)
# Si VERSION est vide, pip installera la dernière version
# Note : L'API web est incluse via openfisca-core[web-api] (pas de package séparé)
RUN if [ -z "$OPENFISCA_FRANCE_VERSION" ]; then \
        pip install --no-cache-dir openfisca-france; \
    else \
        pip install --no-cache-dir openfisca-france==$OPENFISCA_FRANCE_VERSION; \
    fi

# Afficher les versions installées (utile pour le debug)
RUN pip list | grep -i openfisca

# Changer le propriétaire du répertoire
RUN chown -R openfisca:openfisca /app

# Passer à l'utilisateur non-root
USER openfisca

# Exposer le port 8000 (port par défaut d'OpenFisca)
# Note : Mappé vers 2000 en externe via docker-compose
EXPOSE 8000

# Healthcheck : vérifier que l'API répond
# Testé toutes les 30s, timeout 10s, 3 tentatives avant "unhealthy"
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/spec || exit 1

# Commande par défaut : démarrer OpenFisca Web API
# Note : openfisca serve écoute sur le port 8000 par défaut (non configurable facilement)
# On mappe donc 8000 (interne) vers 2000 (externe) dans docker-compose
#
# Arguments :
#   --bind 0.0.0.0 : accessible depuis l'extérieur du container
#   --workers 3 : 3 processus workers pour gérer les requêtes parallèles
#   --country-package openfisca_france : utilise le package France
CMD ["openfisca", "serve", "--bind", "0.0.0.0", "--workers", "3", "--country-package", "openfisca_france"]

