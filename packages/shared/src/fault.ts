// Le contrat de faute d'ADR-0050 : ce qu'un domaine RÉPOND quand il refuse.
//
// Une union discriminée PLATE. Pas de sous-objet `params` : il serait présent dans 100 % des membres
// avec un sens invariant, donc une profondeur qui ne distingue rien. Un moteur de rendu prend un sac
// et ignore ce qu'il n'utilise pas — `t(fault.code, fault)` fonctionne tel quel.
//
// `resource` est une CHAÎNE par défaut, et c'est délibéré. Le socle ne connaît pas le vocabulaire
// d'un produit : `product`, `order`, `variant` appartiennent au commerce, et les écrire ici referait
// ce qu'ADR-0032 a corrigé pour les cibles référençables. Chaque paquet déclare les ressources qu'il
// possède (`PagesResource`, `AssetsResource`…), chaque produit compose les siennes, et ce sont les
// CONSTRUCTEURS du produit qui ferment le vocabulaire au point d'usage.
//
// D'où le PARAMÈTRE `R` : le socle déclare la forme, un produit l'instancie sur son vocabulaire
// (`EchoppeFault = Fault<EchoppeResource>`). Sans lui, la fermeture ne vaudrait qu'à l'ENTRÉE des
// constructeurs — leur retour reperdrait `resource` en `string`, et rien en aval ne pourrait
// énumérer les ressources : ni le schéma qui sort sur le fil, ni un catalogue exhaustif de surface.
// `= string` garde le socle utilisable tel quel par un paquet qui refuse sans connaître de produit.
//
// Le PARAMÈTRE `K` suit exactement le même raisonnement, pour l'échelle des rangs. Le socle n'en
// connaît aucun : `@repo/auth` ne sait décrire que des ÉTENDUES de droits (`Authority`), et le rang
// — qui gouverne, et à quelle hauteur — est une décision de produit. Échoppe le déclare dans
// `FIRST_RANK_ROLE_KEYS`, un ensemble que le code annonce vouloir étendre à des rangs sur mesure.
//
// Ce fichier ne rend aucun texte. Le rendu appartient à la surface qui lit — administration,
// boutique, CLI —, chacune avec son catalogue `code → message` et son repli.

/**
 * Pourquoi un droit ne peut pas être délégué.
 *
 * Trois prédicats DISTINCTS, que `undelegatableGrants` évaluait déjà séparément avant d'aplatir son
 * verdict dans une liste de chaînes — dont une portait sa raison rédigée en français. Une phrase
 * dans un opérande, c'est précisément ce que cet ADR interdit : la surface ne peut ni la traduire ni
 * la reformater.
 */
export type UndelegatableReason =
  /** Le droit n'est pas détenu par qui l'accorde. La règle de base d'ADR-0038. */
  | 'not_held'
  /** Le droit tient au rang, donc ne se transmet pas — même par qui le détient. */
  | 'rank_bound'
  /** Détenu, mais borné à ses propres lignes ; l'accorder sans la borne est l'élargir. */
  | 'self_only_widened';

/**
 * Pourquoi une valeur est refusée par le schéma qui la décrit.
 *
 * DÉRIVÉE, pas inventée : le générateur de `@repo/fields` n'émet que quinze `ValueErrorType` sur les
 * soixante-quatre de TypeBox — inventaire mesuré en faisant échouer chaque `kind` de champ de toutes
 * les façons que la grammaire autorise. Ces quinze se regroupent par GESTE DE CORRECTION, pas par
 * mot-clé JSON Schema : `StringMinLength`, `NumberMinimum` et `ArrayMinItems` demandent la même
 * chose — agrandir —, et c'est cela que l'appelant a besoin de savoir.
 *
 * Le nom TypeBox lui-même n'entre pas dans le contrat : changer de version du validateur ne doit pas
 * être un changement de contrat.
 *
 * Les bornes restent DEUX raisons et non une. La fusion ne tenait que pour l'administration, qui
 * génère son formulaire depuis le registre et connaît donc déjà `min`/`max`. Mais lire la
 * déclaration exige `schema:read`, quand écrire une occurrence exige `entity:<nom>:update` : une clé
 * d'API d'intégration a le second sans le premier. Elle recevrait « hors bornes » sans jamais
 * pouvoir savoir de quel côté.
 */
export type ValidationReason =
  /** Un champ requis est absent. Le cas dominant, et de loin. */
  | 'required'
  /** Le type ne correspond pas : une chaîne là où un nombre est attendu, et réciproquement. */
  | 'type'
  /** La valeur est hors de la liste close que le champ déclare (`enum`). */
  | 'not_allowed'
  /** Trop court, trop petit, trop peu d'éléments — selon ce que le champ mesure. */
  | 'too_small'
  /** Trop long, trop grand, trop d'éléments. */
  | 'too_large'
  /** La forme attendue n'est pas respectée : `uuid`, `date`, `date-time`. */
  | 'format';

/**
 * Une faute de validation, localisée.
 *
 * `path` est un pointeur JSON (`/titre`, `/blocs/0/lien`, `` `` à la racine) — une DONNÉE, pas de la
 * prose : la surface s'en sert pour surligner le champ fautif, ce qu'une phrase ne permettait pas.
 *
 * Aucune borne n'accompagne `too_small`/`too_large`, et aucune liste n'accompagne `not_allowed` :
 * ce sont des attributs de la DÉCLARATION, pas de la faute. Qui peut lire la déclaration les a ;
 * qui ne le peut pas sait au moins dans quel sens corriger.
 */
export type ValidationIssue = { path: string; reason: ValidationReason };

/**
 * Pourquoi un registre de définitions poussé est refusé.
 *
 * DÉRIVÉE des trois seuls prédicats qui refusaient un registre — `assertRegistryCoherent` les
 * évaluait déjà séparément avant d'aplatir son verdict dans le `message` d'une exception, que la
 * route promouvait ensuite en réponse HTTP. C'est le premier chemin du tableau de violations
 * d'ADR-0050 ; les prédicats, eux, n'ont pas bougé.
 */
export type RegistryIncoherence =
  /** Deux champs de même nom dans une même définition (ADR-0049). */
  | 'duplicate_field'
  /** Un `component`/`list` cite un nom absent du registre. */
  | 'unknown_component'
  /** Un `component` se contient lui-même, directement ou non. */
  | 'circular_component'
  /** Le nom déclaré ne respecte pas la grammaire des identifiants. */
  | 'invalid_name'
  /** La clé sous laquelle une entité est rangée diffère du nom qu'elle déclare. */
  | 'name_mismatch'
  /** Le mode de lien contredit la cardinalité : un singleton n'a pas de slug (ADR-0039). */
  | 'link_cardinality'
  /** Le lien cite un champ que la déclaration ne contient pas. */
  | 'link_unknown_field'
  /** Le champ cité par le lien existe, mais son type ne peut pas porter ce que le lien attend. */
  | 'link_field_type';

/** Une incohérence de registre, localisée dans la déclaration : `hero.encart`, `page.blocs.lien`. */
export type RegistryIssue = { path: string; reason: RegistryIncoherence };

/**
 * Ce qui empêche un plan de migration de s'appliquer — l'ÉTAT de la base, pas la déclaration.
 *
 * À ne pas confondre avec `RegistryIncoherence`, et la distinction n'est pas cosmétique : là, le dev
 * corrige ses fichiers ; ici, sa déclaration est bonne et c'est la base qui n'est pas prête. Deux
 * gestes, deux destinataires — ils étaient pourtant rendus par la même liste de phrases.
 *
 * Union discriminée plutôt que forme plate : chaque membre porte EXACTEMENT ce que l'appelant ne
 * peut pas reconstruire. Il a soumis la déclaration, donc il la connaît ; ce qu'il ignore, c'est
 * l'état de la base. Rien de plus ne traverse — pas de compte de lignes, qui ne change aucun geste.
 */
export type PlanBlocker =
  /** La table contient des lignes, et l'opération demandée les perdrait. Videz-la d'abord. */
  | { reason: 'rows_present'; target: string }
  /**
   * Des valeurs ne désignent plus rien dans la table visée : de la donnée DÉJÀ cassée, que l'absence
   * de contrainte laissait passer. `references` nomme la table visée — l'appelant ne peut pas la
   * déduire, la déclaration ne dit pas où pointent les valeurs réellement stockées.
   */
  | { reason: 'dangling_rows'; target: string; references: string }
  /**
   * L'entité n'est plus déclarée, mais d'autres la référencent encore. `holders` dit LESQUELLES :
   * sans elles, le dev sait qu'il est bloqué sans savoir où retirer les champs. Jamais de cascade
   * (ADR-0028), donc c'est bien à lui d'agir.
   */
  | { reason: 'still_referenced'; target: string; holders: string[] }
  /** Une colonne que ce mécanisme n'a pas pu créer, donc qu'il ne supprimera pas. */
  | { reason: 'unmanaged_column'; target: string };

export type Fault<R extends string = string, K extends string = string> =
  /** La chose désignée n'existe pas. Absorbe à elle seule la moitié des refus de l'API. */
  | { code: 'not_found'; resource: R }
  /** Une contrainte d'unicité refuse : `field` nomme la colonne qui collisionne. */
  | { code: 'already_exists'; resource: R; field: string }
  /** Suppression refusée parce que la chose est référencée. `usedBy` nomme ce qui la retient. */
  | { code: 'in_use'; resource: R; usedBy: R }
  /** L'état courant interdit la transition demandée. */
  | { code: 'invalid_state'; resource: R; current: string; expected: string }
  /**
   * `variant` identifie CE dont le stock manque, et il est obligatoire : « stock insuffisant » sans
   * dire de quoi ne désigne rien — deux quantités ne sont pas une faute complète. Même structure
   * qu'`in_use`, qui porte `resource` et `usedBy` sans que l'un soit facultatif.
   *
   * Il n'est pas nommé `resource` : ce n'est pas une valeur du vocabulaire de fautes mais
   * l'identifiant d'une ligne. Et il ne porte pas le NOM du produit, qui est une donnée marchande —
   * la surface a affiché le panier, elle retrouve le libellé depuis l'identifiant.
   */
  | { code: 'insufficient_stock'; variant: string; available: number; requested: number }
  /** Aucune identité présentée, ou session expirée — les deux sont indiscernables pour l'appelant. */
  | { code: 'unauthenticated' }
  /**
   * Identifiants refusés.
   *
   * Volontairement indistinct entre « adresse inconnue » et « mot de passe faux » : les distinguer
   * ferait de l'endpoint un oracle d'énumération. C'est le seul cas où le domaine émet SCIEMMENT
   * une faute moins précise qu'il ne le pourrait, et c'est une propriété de sécurité — aucun
   * catalogue de lecture ne pourrait rattraper la distinction si elle était émise.
   */
  | { code: 'invalid_credentials' }
  /** Jeton de lien invalide ou expiré — même indistinction délibérée. */
  | { code: 'invalid_token' }
  /**
   * `resource` reste une CHAÎNE même instanciée : le RBAC a son propre vocabulaire (ADR-0038), qui
   * porte l'espace ouvert `entity:<nom>` — inconnu à la compilation par nature.
   */
  | { code: 'permission_denied'; action: string; resource: string }
  /** La cible est protégée en elle-même : propriétaire de l'installation, rôle système. */
  | { code: 'protected_subject'; resource: R }
  /** L'acte est interdit sur soi-même (se désactiver, se supprimer). */
  | { code: 'self_action_forbidden'; action: string }
  /** L'acte n'est permis QUE sur soi — le miroir exact du précédent (changer son mot de passe). */
  | { code: 'self_only'; action: string }
  /**
   * L'acte demande un rang que l'appelant n'a pas. `requires` porte le seuil, sans quoi la surface
   * ne pourrait pas distinguer « réservé au propriétaire » de « réservé au premier rang » — deux
   * hauteurs que les gardes testent séparément (`isTheOwner` contre `isFirstRank`).
   *
   * Remplace un `owner_only` qui ne savait nommer qu'un seul seuil.
   *
   * `grants` est le SEUL champ facultatif du contrat, et il n'a le droit de l'être que parce que la
   * surface ne peut pas reconstruire l'information depuis sa propre requête : la révocation en masse
   * REMPLACE l'ensemble des droits, donc ce qui disparaît n'est pas ce que l'appelant a soumis.
   * Ailleurs, l'acte est explicite et la liste n'aurait rien à dire.
   *
   * Avant d'ajouter un second champ facultatif ici ou ailleurs, relire le critère (ADR-0050 §5,
   * « Quand un opérande a le droit d'être facultatif ») : sans lui, chaque membre de l'union finit
   * par porter ses propres données de diagnostic, et `Fault` redevient un sac.
   */
  | { code: 'rank_reserved'; action: string; requires: K; grants?: string[] }
  /**
   * Des droits refusés à la délégation, chacun avec son prédicat. La liste plutôt qu'un booléen :
   * l'appelant doit pouvoir corriger sa soumission, donc savoir CE QUI est refusé.
   */
  | { code: 'undelegatable_grants'; grants: { grant: string; reason: UndelegatableReason }[] }
  /** La ressource existe mais n'appartient pas à l'appelant. */
  | { code: 'forbidden_resource'; resource: R }
  /**
   * Une URL de redirection est refusée. `field` nomme laquelle (`successUrl`, `cancelUrl`).
   *
   * La RAISON ne voyage pas, et c'est délibéré : la garde fusionne quatre prédicats — URL non
   * parsable, protocole non web, http en production, hôte hors whitelist — et les distinguer
   * renseignerait un attaquant sur la configuration de l'installation. Même arbitrage
   * qu'`invalid_credentials` (§4) : on fusionne contre un oracle, pas par commodité.
   *
   * Code SPÉCIFIQUE et non un `value_not_allowed` général : un concept général serait un mensonge
   * ici, puisque l'un des quatre prédicats refuse une valeur qui n'est même pas syntaxiquement
   * valide. Et la mesure ne montre aucune autre garde de ce genre dans le dépôt.
   */
  | { code: 'redirect_url_rejected'; field: string }
  /**
   * Une valeur de personnalisation est refusée (ADR-0010). `field` est l'IDENTIFIANT du champ,
   * jamais son libellé : celui-ci est saisi par le marchand, et la surface qui rend le message a
   * déjà la déclaration — elle a affiché le formulaire — donc elle retrouve seule le libellé et le
   * `maxLength`. Rien de ce que le marchand administre ne traverse le contrat, et aucun opérande
   * facultatif n'est nécessaire (cf. le critère plus haut).
   */
  | {
      code: 'personalization_rejected';
      field: string;
      reason: 'unknown' | 'required' | 'too_long';
    }
  /**
   * La cardinalité déclarée d'une entité interdit cette écriture : un singleton a déjà sa ligne.
   *
   * Distinct d'`already_exists`, qui nomme un CHAMP en collision. Ici rien ne collisionne : c'est la
   * forme de l'entité qui borne le nombre de lignes, et aucun champ n'y est pour quelque chose.
   */
  | { code: 'cardinality_exceeded'; resource: R }
  /**
   * Un push de schéma détruirait des données, et il est refusé tant qu'on ne le confirme pas
   * (ADR-0027). `steps` nomme ce qui aurait été détruit — sans quoi le développeur ne peut pas
   * décider s'il relance.
   *
   * `kind` et `target`, jamais la phrase que la CLI affiche : celle-ci reste dans `@repo/entities`
   * comme diagnostic de terminal, la seule surface que cet ADR exempte.
   */
  | {
      code: 'destructive_plan';
      steps: { kind: 'recreate_table' | 'drop_column' | 'drop_table'; target: string }[];
    }
  /** Une configuration manque : clé d'environnement, provider non branché. */
  | { code: 'configuration_missing'; target: string }
  /** Un champ requis manque — typiquement une exigence CONDITIONNELLE que le schéma ne porte pas. */
  | { code: 'required_data_missing'; field: string }
  /** Validation structurelle : `details` liste les fautes, une par entrée, jamais jointes. */
  | { code: 'validation_failed'; details: ValidationIssue[] }
  /**
   * La requête ne demande rien : aucun champ à écrire.
   *
   * Ce n'est PAS une donnée invalide — il n'y a ni chemin ni champ fautif à nommer. Le distinguer
   * de `validation_failed` évite de ranger sous « donnée refusée » une requête simplement vide.
   */
  | { code: 'empty_patch' }
  /** Une déclaration poussée — registre de sections ou d'entités — ne tient pas debout. */
  | { code: 'registry_incoherent'; issues: RegistryIssue[] }
  /**
   * La déclaration est bonne, mais l'état de la base empêche de l'appliquer.
   *
   * Jumeau de `destructive_plan`, produit par le même planificateur : l'un refuse ce qui détruirait,
   * l'autre ce qui ne peut pas s'exécuter. Aucun des deux ne s'applique à moitié.
   */
  | { code: 'blocked_plan'; blockers: PlanBlocker[] }
  | { code: 'unknown_reference_targets'; targets: string[] }
  | { code: 'unknown_scopes'; scopes: string[] }
  /** Un système tiers a échoué. `operation` le nomme sans exposer son diagnostic. */
  | { code: 'external_operation_failed'; operation: string };

export type FaultCode = Fault['code'];

/** Le membre d'une union de fautes qui porte un code donné — de quoi typer un catalogue par code. */
export type FaultOf<
  C extends FaultCode,
  R extends string = string,
  K extends string = string,
> = Extract<Fault<R, K>, { code: C }>;

/**
 * Ce qui part sur le fil.
 *
 * Les métadonnées de transport vivent À CÔTÉ de la faute, jamais dedans : ça évite qu'un champ
 * d'enveloppe entre en collision avec un champ métier, sans payer une indirection sur le chemin de
 * lecture, qui est le chemin fréquent.
 *
 * `incident` corrèle une réponse à sa trace de log. Il n'a de sens que lorsqu'une projection a
 * RETIRÉ des champs pour l'audience : l'utilisateur le transmet au support, qui retrouve la cause
 * réelle. Opaque par construction — c'est la seule chose qui doive l'être, les codes n'étant que des
 * clés.
 *
 * @remarks `message` est le format hérité. Il reste rempli pendant la migration parce que
 * l'administration le lit dans huit vues, et disparaît quand elles auront leur catalogue.
 */
export type ErrorResponse<R extends string = string, K extends string = string> = {
  fault: Fault<R, K>;
  incident?: string;
  /** @deprecated Format hérité — lire `fault`. Retiré à la fin de la migration d'ADR-0050. */
  message: string;
};
