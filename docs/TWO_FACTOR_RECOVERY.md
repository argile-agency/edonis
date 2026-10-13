# Récupération de l'authentification à deux facteurs (2FA)

Ce document décrit comment un compte protégé par la double authentification (TOTP) est récupéré lorsque l'utilisateur n'a plus accès à son application d'authentification. Il existe trois parcours, du plus courant au plus exceptionnel : l'utilisateur lui-même avec ses codes de récupération, un administrateur depuis l'interface, et un opérateur depuis la ligne de commande (break-glass) quand plus aucun administrateur ne peut se connecter. Chaque réinitialisation est tracée dans le journal d'audit.

## Fonctionnement de la vérification en attente

Après un mot de passe correct, un utilisateur dont la 2FA est activée n'est pas encore connecté : la connexion est « en attente » jusqu'à la saisie d'un code TOTP ou d'un code de récupération valide.

- La connexion en attente expire **10 minutes** après la vérification du mot de passe. Passé ce délai, l'utilisateur est renvoyé vers la page de connexion et doit ressaisir son mot de passe. Événement d'audit : `user.login.2fa_expired`.
- Au bout de **5 tentatives** erronées, la connexion en attente est verrouillée et l'utilisateur est renvoyé vers la page de connexion. Événement d'audit : `user.login.2fa_locked`.
- Les routes de vérification (`POST /two-factor/challenge` et `POST /two-factor/challenge/recovery`) sont limitées par utilisateur (5 requêtes par minute, puis blocage de 15 minutes), en plus de la limite par adresse IP de la connexion. Un attaquant ne peut donc pas multiplier les essais en changeant d'adresse IP.

## Parcours utilisateur

C'est le parcours normal : l'utilisateur a perdu son téléphone mais a conservé ses codes de récupération.

1. Se connecter avec son email et son mot de passe.
2. Sur la page de vérification 2FA, choisir l'option code de récupération et saisir l'un des codes fournis lors de l'activation. Chaque code n'est utilisable qu'une seule fois.
3. Une fois connecté, aller sur `/user/two-factor` pour régénérer de nouveaux codes de récupération, ou désactiver puis réactiver la 2FA avec le nouvel appareil.

Les codes de récupération doivent être conservés hors de l'appareil d'authentification (gestionnaire de mots de passe, copie papier).

## Parcours administrateur

Si l'utilisateur a perdu à la fois son appareil et ses codes de récupération, un administrateur peut réinitialiser sa 2FA :

1. Ouvrir la fiche de l'utilisateur dans `/admin/users/:id`.
2. Dans la carte « Actions », cliquer sur **Réinitialiser la 2FA** (le bouton n'apparaît que si la 2FA est activée), puis confirmer.
3. Le secret TOTP, les codes de récupération et la date de confirmation sont effacés. L'utilisateur peut alors se connecter avec son seul mot de passe et **doit réactiver la 2FA** depuis `/user/two-factor`.

Cette action est réservée au rôle `admin`, limitée à 5 réinitialisations par minute et par administrateur, et tracée sous l'action `admin.user.2fa.reset` avec l'identifiant de l'administrateur. Vérifier l'identité de l'utilisateur par un autre canal avant de réinitialiser : cette opération supprime un facteur d'authentification.

## Parcours opérateur (break-glass)

Quand plus aucun administrateur ne peut se connecter (par exemple, le seul administrateur a perdu son appareil et ses codes), un opérateur ayant un accès shell au serveur applicatif peut réinitialiser la 2FA en ligne de commande.

En développement, depuis la racine du projet :

```bash
node ace user:reset-2fa utilisateur@exemple.fr
```

En production, depuis le répertoire du build (`build/`), qui ne contient que le JavaScript compilé :

```bash
cd build
node bin/console.js user:reset-2fa utilisateur@exemple.fr
```

Comportement :

- Si aucun utilisateur ne correspond à l'email, la commande affiche une erreur et se termine avec le code de sortie `1`.
- Si la 2FA n'est pas activée pour cet utilisateur, la commande ne modifie rien.
- Sinon, elle efface les champs 2FA, écrit une ligne d'audit `cli.user.2fa.reset` (sans utilisateur acteur, puisqu'aucune session HTTP n'existe) et affiche `2FA reset for user_id=<id>`. Aucune autre donnée personnelle n'est affichée.

Cette commande contourne l'authentification HTTP : elle ne doit être utilisée que par l'exploitant de la plateforme, après vérification de l'identité du demandeur.

## Rotation de l'APP_KEY

Le secret TOTP, les codes de récupération et les données personnelles chiffrées (téléphone, adresse, identifiant) sont chiffrés avec l'`APP_KEY`. **Changer l'`APP_KEY` rend toutes ces valeurs indéchiffrables.** Concrètement :

- Aucun code TOTP ni code de récupération ne fonctionne plus pour les utilisateurs ayant activé la 2FA. Chaque échec de déchiffrement est journalisé et apparaît dans le journal d'audit sous l'action `user.2fa.decrypt_failed`. L'utilisateur voit simplement « code invalide ».
- Ces utilisateurs doivent être réinitialisés, soit par un administrateur (parcours administrateur), soit en ligne de commande (parcours opérateur) si l'administrateur est lui-même concerné.

Après tout changement de clé, lancer l'analyse des données personnelles chiffrées :

```bash
node ace pii:scan
```

Tant que cette analyse signale des valeurs indéchiffrables, laisser `PII_DECRYPT_STRICT` à `false` (ou non défini). Avec `PII_DECRYPT_STRICT=true`, chaque requête d'un utilisateur dont une donnée personnelle est indéchiffrable déclenche une erreur, et ces utilisateurs obtiennent une page d'erreur au lieu de l'application. Ne repasser la variable à `true` qu'une fois les données réparées et l'analyse propre.

La meilleure protection reste de ne pas changer l'`APP_KEY` d'un environnement existant et de la sauvegarder avec les sauvegardes de la base de données.

## Vérification

Pour confirmer qu'une réinitialisation a bien eu lieu :

1. Se connecter en administrateur et ouvrir le journal d'audit : `/admin/audit-logs`.
2. Filtrer sur l'action `admin.user.2fa.reset` (réinitialisation depuis l'interface) ou `cli.user.2fa.reset` (réinitialisation en ligne de commande).
3. La colonne ressource indique l'identifiant de l'utilisateur concerné. Pour `admin.user.2fa.reset`, l'utilisateur acteur est l'administrateur, et l'adresse IP et le user agent sont enregistrés. Pour `cli.user.2fa.reset`, l'utilisateur acteur est vide.
4. Sur la fiche de l'utilisateur, le bouton « Réinitialiser la 2FA » n'apparaît plus tant que l'utilisateur n'a pas réactivé sa 2FA.
