# Configuration

Échoppe utilise des variables d'environnement pour sa configuration. Copiez le fichier `.env.example` vers `.env` et adaptez les valeurs.

## Variables d'environnement

### Base de données

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://echoppe:echoppe@localhost:5432/echoppe` |

### Redis (optionnel)

Fournir `REDIS_URL` active le rate-limit distribué ; sans lui, l'API fonctionne
normalement (dégradation sans erreur).

| Variable | Description | Défaut |
|----------|-------------|--------|
| `REDIS_URL` | URL de connexion Redis | *(non défini)* |

### API

| Variable | Description | Défaut |
|----------|-------------|--------|
| `API_PORT` | Port publié sur l’hôte | `8100` |
| `API_URL` | URL publique de l'API | `http://localhost:8100` |
| `ADMIN_URL` | URL du dashboard admin (CORS) | `http://localhost:8100/-/admin` |
| `STORE_URL` | URL de la boutique (CORS) | `http://localhost:3100` |

### Sécurité

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ENCRYPTION_KEY` | Clé de chiffrement AES-256 (32 bytes base64) | - |

::: warning ENCRYPTION_KEY obligatoire
Cette clé est requise pour chiffrer les credentials des prestataires (Stripe, PayPal, SMTP...).

Générez-la avec :
```bash
openssl rand -base64 32
```

**Important :** Conservez cette clé précieusement. Si vous la perdez, vous devrez reconfigurer tous vos prestataires.
:::

### Email

| Variable | Description | Défaut |
|----------|-------------|--------|
| `SMTP_HOST` | Serveur SMTP | - |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | - |
| `SMTP_PASS` | Mot de passe SMTP | - |
| `SMTP_FROM` | Email expéditeur | - |

### Paiements

| Variable | Description | Défaut |
|----------|-------------|--------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe | - |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe | - |
| `PAYPAL_CLIENT_ID` | Client ID PayPal | - |
| `PAYPAL_CLIENT_SECRET` | Secret PayPal | - |

### Livraison

| Variable | Description | Défaut |
|----------|-------------|--------|
| `COLISSIMO_CONTRACT` | Numéro de contrat Colissimo | - |
| `COLISSIMO_PASSWORD` | Mot de passe Colissimo | - |
| `SENDCLOUD_PUBLIC_KEY` | Clé publique Sendcloud | - |
| `SENDCLOUD_SECRET_KEY` | Clé secrète Sendcloud | - |

## Exemple de fichier .env

```bash
# Database
DATABASE_URL=postgresql://echoppe:echoppe@localhost:5432/echoppe

# Redis (optionnel — rate-limit distribué)
# REDIS_URL=redis://localhost:6379

# API
API_PORT=8100
API_URL=http://localhost:8100
ADMIN_URL=http://localhost:8100/-/admin
STORE_URL=http://localhost:3100

# Security (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=votre-cle-base64-de-32-bytes

# Email (development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@echoppe.local
```

## Configuration des prestataires

Les prestataires de paiement et livraison se configurent dans l'interface d'administration :

1. Aller dans **Prestataires**
2. Configurer les clés API pour chaque service
3. Activer les prestataires souhaités

Voir la documentation [Paramètres](/admin/settings) pour plus de détails.
