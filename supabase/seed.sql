-- All records created here are synthetic, non-contactable and unsuitable for production use.
-- Local Auth identities are bootstrapped separately from ignored environment credentials.
select private.seed_synthetic_baseline();
select private.seed_wi005_synthetic_fixtures(null);
select private.seed_wi006_partner_analysis();
