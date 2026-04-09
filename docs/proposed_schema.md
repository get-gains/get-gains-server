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