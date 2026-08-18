# Vue d'ensemble

Le dashboard d'administration d'Échoppe permet de gérer l'ensemble de votre boutique en ligne.

## Accès

- **URL** : http://localhost:8100/-/admin (développement)
- **Identifiants par défaut** : `admin@echoppe.dev` / `admin123`

## Navigation

La sidebar à gauche donne accès aux différentes sections :

### Catalogue
- **[Produits](/admin/products)** - Créer et gérer les produits, variantes et options
- **[Organisation](/admin/taxonomy)** - Catégories et collections
- **[Stock](/admin/stock)** - Mouvements de stock et alertes

### Commandes
- **[Commandes](/admin/orders)** - Suivi et gestion des commandes
- **[Clients](/admin/customers)** - Base clients et conformité RGPD
- **Prestataires** - Configuration paiements et livraison

### Contenu
- **[Médiathèque](/admin/media)** - Gestion des images et fichiers

### Configuration
- **[Paramètres](/admin/settings)** - Informations boutique, rôles et utilisateurs
- **Journal d'audit** - Historique des actions

## Tableau de bord

Le tableau de bord affiche un résumé de l'activité :

- Commandes récentes
- Alertes de stock
- Statistiques de vente

## Permissions

L'accès aux fonctionnalités dépend du rôle de l'utilisateur :

| Rôle | Description |
|------|-------------|
| **Owner** | Accès complet, ne peut pas être supprimé |
| **Admin** | Accès complet sauf suppression du owner |
| **Manager** | Gestion catalogue et commandes |
| **Viewer** | Lecture seule |

Voir [Paramètres > Rôles](/admin/settings#roles) pour créer des rôles personnalisés.
