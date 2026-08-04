-- Revert 013_pro_lifetime_emails_zazamin_aoi

delete from public.choreocore_pro_lifetime_emails
where lower(email) in (
  lower('zazamin0808@gmail.com'),
  lower('aoi753695@gmail.com')
);

-- 付与・billing は他経路でも付与されうるため、このメール由来分のみ弱く戻す場合は
-- Dashboard で個別確認してから revoke / entitlement_lifetime = false を実行してください。
