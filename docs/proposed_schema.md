user {
    PK      supabase_auth_id            VARCHAR         NOT NULL
    UK      email                       VARCHAR         NOT NULL
            full_name                   VARCHAR         NOT NULL
            nickname                    VARCHAR         NOT NULL
            is_coach                    BOOLEAN         NULL
            bio                         TEXT            NULL
            avatar_key                  VARCHAR         NULL
            height_cm                   INT             NULL
            weight_kg                   INT             NULL
            sex                         VARCHAR         NULL
            date_of_birth               TIMESTAMPTZ     NULL
            equipment_available         VARCHAR[]       NULL
            experience_level            VARCHAR         NULL
            active_weekdays             VARCHAR[]       NULL
            coin_balance                INT             NOT NULL    DEFAULT 0
            deleted_at                  TIMESTAMPTZ     NULL
}

coach {
    PK,FK   user_id                     VARCHAR         NOT NULL
            certifications              VARCHAR[]       NULL
            specialties                 VARCHAR[]       NULL
            social_links                VARCHAR[]       NULL
            max_clients                 INT             NOT NULL
            accepting_clients           BOOLEAN         NOT NULL    DEFAULT true
            is_discoverable             BOOLEAN         NOT NULL    DEFAULT true
}

subscribed_coach {
    PK      id                          VARCHAR         NOT NULL    DEFAULT cuid()
    FK      coach_id                    VARCHAR         NOT NULL
    FK      user_id                     VARCHAR         NOT NULL
            started_at                  TIMESTAMPTZ     NOT NULL    DEFAULT now()
            ended_at                    TIMESTAMPTZ     NULL
}

program {
    PK      id                          VARCHAR         NOT NULL    DEFAULT cuid()
    FK      user_id                     VARCHAR         NOT NULL
            name                        VARCHAR         NOT NULL
            description                 TEXT            NOT NULL
            deleted_at                  TIMESTAMPTZ     NULL
}

routine {
    PK      id                          VARCHAR         NOT NULL    DEFAULT cuid()
    FK      user_id                     VARCHAR         NOT NULL
            name                        VARCHAR         NOT NULL
            description                 TEXT            NOT NULL
            estimated_duration_minutes  INT             NOT NULL
            deleted_at                  TIMESTAMPTZ     NULL
}

exercise {
    PK      id                          VARCHAR         NOT NULL    DEFAULT cuid()
    FK      user_id                     VARCHAR         NOT NULL
            name                        VARCHAR         NOT NULL
            description                 TEXT            NOT NULL
            target_muscles              VARCHAR[]       NOT NULL
            // merged from tracked_angles, use tracked angles' values
            active_segments             VARCHAR[]       NOT NULL 
            deleted_at                  TIMESTAMPTZ     NULL
}

exercise_form {
    PK      id                          VARCHAR         NOT NULL    DEFAULT cuid()
    FK      exercise_id                 VARCHAR         NOT NULL
            camera_angle                VARCHAR         NOT NULL
            recorded_frames_key         VARCHAR         NOT NULL
}

// Snapshot pattern

assigned_program {
    // I feel like i can merge one of these 3 together to make a composite key or to optimize querying
    PK      id                          VARCHAR         NOT NULL 
    FK      user_id                     VARCHAR         NOT NULL
    FK      program_id                  VARCHAR         NOT NULL
            notes                       TEXT            NULL
            start_date                  TIMESTAMPTZ     NULL
            end_date                    TIMESTAMPTZ     NULL
}

assigned_program_routine {
    PK      id                          VARCHAR         NOT NULL
    FK      routine_id                  VARCHAR         NOT NULL
    FK      assigned_program_id         VARCHAR         NOT NULL
            days_of_week                VARCHAR[]       NOT NULL
            deleted_at                  TIMESTAMPTZ     NULL
}

assigned_program_routine_exercise {
    PK      id                          VARCHAR         NOT NULL
            assigned_program_routine_id VARCHAR         NOT NULL
            sets                        INT             NOT NULL
            reps_min                    INT             NOT NULL
            reps_max                    INT             NOT NULL
            rest_seconds                INT             NOT NULL
            order_in_routine            INT             NOT NULL
            deleted_at                  TIMESTAMPTZ     NULL
}

workout_session {
    PK      id                          VARCHAR         NOT NULL
    FK      assigned_program_routine_id VARCHAR         NOT NULL
            started_at                  TIMESTAMPTZ     NULL
            completed_at                TIMESTAMPTZ     NULL
            feedback                    TEXT            NULL
            deleted_at                  TIMESTAMPTZ     NULL
}

performed_set {
    PK      id                                      VARCHAR         NOT NULL
    FK      workout_session_id                      VARCHAR         NOT NULL
    FK      assigned_program_routine_exercise_id    VARCHAR         NOT NULL
            reps                                    INT             NOT NULL
            weight                                  REAL            NOT NULL
            overall_score                           INT             NOT NULL
            // turned into key, JSON blob to S3 storage
            recorded_frames_key                     VARCHAR         NOT NULL
            completed_at                            TIMESTAMPTZ     NOT NULL
            deleted_at                              TIMESTAMPTZ     NOT NULL
}

cosmetics {
    PK      id                                      VARCHAR         NOT NULL
            name                                    VARCHAR         NOT NULL
            description                             TEXT            NOT NULL
            tier                                    INT             NOT NULL
            price                                   INT             NOT NULL
            category                                VARCHAR         NOT NULL
            preview_image_key                       VARCHAR         NOT NULL
            deleted_at                              TIMESTAMPTZ     NOT NULL
}

// Gamification domain

user_cosmetic {
    PK,FK   user_id                                 VARCHAR         NOT NULL
    PK,FK   cosmetic_id                             VARCHAR         NOT NULL
            equipped_at                             TIMESTAMPTZ     NULL
}

coin_transactions {
    PK      id                                      VARCHAR         NOT NULL
    FK      user_id                                 VARCHAR         NOT NULL
            transaction_type                        VARCHAR         NOT NULL
            value                                   INT             NOT NULL
}

partner {
    PK      id                                      VARCHAR         NOT NULL
            name                                    VARCHAR         NOT NULL
            logo_key                                VARCHAR         NOT NULL
            bio                                     TEXT            NOT NULL
            social_links                            VARCHAR[]       NOT NULL
}

mission {
    PK      id                                      VARCHAR         NOT NULL
    FK      partner_id                              VARCHAR         NULL
            title                                   VARCHAR         NOT NULL
            description                             TEXT            NOT NULL
            goal_type                               VARCHAR         NOT NULL
            goal_to_reach                           INT             NOT NULL
            reward_title                            TEXT            NULL
            reward_description                      TEXT            NULL
            reward_image_key                        TEXT            NULL
            max_winners                             INT             NULL
            is_repeatable                           BOOLEAN         NULL
            starts_at                               TIMESTAMPTZ     NULL
            ends_at                                 TIMESTAMPTZ     NULL
}

user_mission {
    PK      id                                      VARCHAR         NOT NULL
    FK      user_id                                 VARCHAR         NOT NULL
    FK      mission_id                              VARCHAR         NOT NULL
            status                                  VARCHAR         NOT NULL
            progress                                VARCHAR         NOT NULL    DEFAULT 0
}

raffle_entry {
    PK      id                                      VARCHAR         NOT NULL
    FK      user_mission_id                         VARCHAR         NOT NULL
            is_winner                               BOOLEAN         NOT NULL    DEFAULT FALSE
}

// ==================== Subscription Domain ====================

subscription_plan {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
            name                                    VARCHAR         NOT NULL    UNIQUE
            description                             TEXT            NOT NULL
            features                                TEXT[]          NOT NULL
            tier_level                              INT             NOT NULL    DEFAULT 0   // 0=Free, 1=Basic, 2=Premium, 3=Pro
            billing_cycle                           VARCHAR         NOT NULL                // MONTHLY, YEARLY, etc.
            price_cents                             INT             NOT NULL                // Display price; provider is billing source of truth
            currency                                VARCHAR         NOT NULL    DEFAULT 'PHP'
            trial_period_days                       INT             NULL
            is_active                               BOOLEAN         NOT NULL    DEFAULT true
            sort_order                              INT             NOT NULL    DEFAULT 0
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
            updated_at                              TIMESTAMPTZ     NOT NULL
    // IDX(is_active, sort_order)
}

provider_plan {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
    FK      subscription_plan_id                    VARCHAR         NOT NULL
            provider                                VARCHAR         NOT NULL                // GOOGLE_PLAY, APPLE
            provider_product_id                     VARCHAR         NOT NULL                // Full composite ID from provider
            provider_subscription_id                VARCHAR         NULL                    // Subscription-only portion (fallback lookup)
            provider_base_plan_id                   VARCHAR         NULL                    // Base plan portion
            provider_metadata                       JSONB           NULL
            is_active                               BOOLEAN         NOT NULL    DEFAULT true
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
            updated_at                              TIMESTAMPTZ     NOT NULL
    // UQ(provider, provider_product_id)
    // IDX(provider, provider_subscription_id)
}

subscription {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
    FK      user_id                                 VARCHAR         NOT NULL
    FK      subscription_plan_id                    VARCHAR         NOT NULL
            provider                                VARCHAR         NOT NULL                // GOOGLE_PLAY, APPLE
            status                                  VARCHAR         NOT NULL                // PENDING, ACTIVE, PAST_DUE, CANCELED, EXPIRED, REVOKED, PAUSED
            external_subscription_id                VARCHAR         NOT NULL    UNIQUE      // Provider's subscription ID
            // Billing cycle tracking
            start_date                              TIMESTAMPTZ     NOT NULL
            current_period_start                    TIMESTAMPTZ     NOT NULL
            current_period_end                      TIMESTAMPTZ     NOT NULL                // CRITICAL: auth middleware WHERE > now()
            next_billing_date                       TIMESTAMPTZ     NOT NULL
            // Cancellation
            cancel_at_period_end                    BOOLEAN         NOT NULL    DEFAULT false
            canceled_at                             TIMESTAMPTZ     NULL
            ended_at                                TIMESTAMPTZ     NULL
            // Trial
            trial_start_date                        TIMESTAMPTZ     NULL
            trial_end_date                          TIMESTAMPTZ     NULL
            // Provider-specific
            purchase_token                          VARCHAR         NULL                    // CRITICAL: webhook lookup (Google Play)
            order_id                                VARCHAR         NULL                    // Latest order ID from provider
            auto_renew                              BOOLEAN         NOT NULL    DEFAULT true
            provider_metadata                       JSONB           NULL
            // Discount tracking (replaces removed PromoCode system)
            is_discounted                           BOOLEAN         NOT NULL    DEFAULT false
            discount_description                    VARCHAR         NULL
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
            updated_at                              TIMESTAMPTZ     NOT NULL
    // IDX(user_id, status, current_period_end) — auth middleware hot path
    // IDX(purchase_token) — webhook correlation
    // IDX(user_id, created_at) — subscription history
}

subscription_plan_history {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
    FK      subscription_id                         VARCHAR         NOT NULL
    FK      subscription_plan_id                    VARCHAR         NOT NULL
            effective_from                          TIMESTAMPTZ     NOT NULL
            effective_until                         TIMESTAMPTZ     NULL                    // NULL = current plan
            change_reason                           VARCHAR         NULL                    // "upgrade", "downgrade", "initial"
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
    // IDX(subscription_id, effective_until) — find current plan
    // IDX(subscription_id, effective_from) — temporal queries
}

payment_history {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
    FK      user_id                                 VARCHAR         NOT NULL
    FK      subscription_id                         VARCHAR         NOT NULL
    FK      subscription_plan_id                    VARCHAR         NOT NULL                // Denormalized for queries
            provider                                VARCHAR         NOT NULL                // GOOGLE_PLAY, APPLE
            amount_cents                            INT             NOT NULL
            currency                                VARCHAR         NOT NULL
            payment_date                            TIMESTAMPTZ     NOT NULL
            provider_order_id                       VARCHAR         NOT NULL
            status                                  VARCHAR         NOT NULL    DEFAULT 'COMPLETED'  // COMPLETED, FAILED, PENDING, REFUNDED
            payment_method                          VARCHAR         NULL
            // Refund tracking
            refunded_at                             TIMESTAMPTZ     NULL
            refund_amount_cents                     INT             NULL
            refund_reason                           VARCHAR         NULL
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
            updated_at                              TIMESTAMPTZ     NOT NULL
    // UQ(subscription_id, provider_order_id) — idempotency
    // IDX(user_id, payment_date) — user payment history
    // IDX(status) — filter failed/refunded
}

webhook_event {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
            idempotency_key                         VARCHAR         NOT NULL    UNIQUE      // e.g., Google Pub/Sub messageId
            provider                                VARCHAR         NOT NULL
            event_type                              VARCHAR         NOT NULL                // Raw provider event type
    FK      subscription_id                         VARCHAR         NULL                    // Resolved after processing
            raw_payload                             JSONB           NOT NULL
            status                                  VARCHAR         NOT NULL    DEFAULT 'PENDING'    // PENDING, PROCESSING, COMPLETED, FAILED
            error_message                           TEXT            NULL
            retry_count                             INT             NOT NULL    DEFAULT 0
            processed_at                            TIMESTAMPTZ     NULL                    // Set on completion (not on creation)
            ip_address                              VARCHAR         NULL
            user_agent                              VARCHAR         NULL
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
            updated_at                              TIMESTAMPTZ     NOT NULL
    // IDX(status, created_at) — retry queue
    // IDX(subscription_id) — webhooks per subscription
    // IDX(provider, event_type) — debugging filter
}

subscription_event {
    PK      id                                      VARCHAR         NOT NULL    DEFAULT cuid()
    FK      subscription_id                         VARCHAR         NOT NULL
            event_type                              VARCHAR         NOT NULL                // CREATED, RENEWED, CANCELED, EXPIRED, PAUSED, RESUMED, UPGRADED, DOWNGRADED, REFUNDED, PAYMENT_FAILED, PAYMENT_RECOVERED, PRICE_CHANGE, GRACE_PERIOD_ENTERED
            from_status                             VARCHAR         NULL
            to_status                               VARCHAR         NULL
            triggered_by                            VARCHAR         NULL                    // "user", "system", "webhook", "admin"
            reason                                  TEXT            NULL
    FK      webhook_event_id                        VARCHAR         NULL                    // Links state change to its webhook
            metadata                                JSONB           NULL
            created_at                              TIMESTAMPTZ     NOT NULL    DEFAULT now()
    // IDX(subscription_id, created_at) — event timeline
    // IDX(webhook_event_id) — trace webhook → state change
}