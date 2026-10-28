-- Purge des notifications personnelles de l'abonnement retiré le 2026-09-03.
--
-- Depuis le commit qui accompagne ce fichier, le backend ne les affiche plus
-- et ne les compte plus dans la cloche : cette purge ne change donc rien à
-- l'écran, elle retire seulement des lignes mortes. À lancer par
-- l'utilisateur, quand il le souhaite. Les valeurs d'enum restent (une
-- migration de NotificationType n'est pas nécessaire).
BEGIN;

DELETE FROM notification
WHERE type IN ('SUBSCRIPTION_EVENTS_ADDED', 'SUBSCRIPTION_SETTLED')
RETURNING type;

COMMIT;
