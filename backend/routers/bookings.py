@router.post("/auto-schedule")
async def auto_schedule(
    body: AutoScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can use auto-schedule")
    if not body.teacher_ids:
        return {"booked": [], "conflicts": []}

    parent_id = current_user["sub"]
    school_id = current_user["school_id"]
    placeholders = ", ".join(f":t{i}" for i in range(len(body.teacher_ids)))
    base_params = {f"t{i}": tid for i, tid in enumerate(body.teacher_ids)}

    name_result = await db.execute(
        text(f"SELECT id, name FROM users WHERE id IN ({placeholders}) AND school_id = :sid"),
        {**base_params, "sid": school_id}
    )
    teacher_names = {str(r.id): r.name for r in name_result.fetchall()}

    slot_result = await db.execute(
        text(
            f"SELECT s.id, s.start_time, s.end_time, s.capacity, s.teacher_id"
            f" FROM slots s"
            f" LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            f" WHERE s.teacher_id IN ({placeholders})"
            f"   AND s.school_id = :sid"
            f"   AND s.id NOT IN ("
            f"     SELECT slot_id FROM bookings"
            f"     WHERE parent_id = :pid AND status != 'cancelled'"
            f"   )"
            f" GROUP BY s.id"
            f" HAVING COUNT(b.id) < s.capacity"
            f" ORDER BY s.start_time"
        ),
        {**base_params, "sid": school_id, "pid": parent_id}
    )
    rows = slot_result.fetchall()

    teacher_slots: dict[str, list] = defaultdict(list)
    for row in rows:
        teacher_slots[str(row.teacher_id)].append(row)

    assigned: list[dict] = []
    conflicts: list[str] = []

    for teacher_id in body.teacher_ids:
        teacher_name = teacher_names.get(teacher_id, teacher_id)
        available = teacher_slots.get(teacher_id, [])
        chosen = None
        for slot in available:
            if not any(
                slot.start_time < a["end_time"] and slot.end_time > a["start_time"]
                for a in assigned
            ):
                chosen = slot
                break
        if chosen:
            assigned.append({
                "teacher_id": teacher_id,
                "teacher_name": teacher_name,
                "slot_id": str(chosen.id),
                "start_time": chosen.start_time,
                "end_time": chosen.end_time,
            })
        else:
            conflicts.append(teacher_name)

    booked: list[dict] = []
    if assigned:
        for a in assigned:
            res = await db.execute(
                text("SELECT id, capacity FROM slots WHERE id = :sid"),
                {"sid": a["slot_id"]}
            )
            slot = res.fetchone()
            if not slot:
                conflicts.append(a["teacher_name"])
                continue
            res = await db.execute(
                text("SELECT COUNT(*) FROM bookings WHERE slot_id = :sid AND status != 'cancelled'"),
                {"sid": a["slot_id"]}
            )
            if res.scalar() >= slot.capacity:
                conflicts.append(a["teacher_name"])
                continue
            res = await db.execute(
                text("SELECT id FROM bookings WHERE slot_id = :sid AND parent_id = :pid AND status != 'cancelled'"),
                {"sid": a["slot_id"], "pid": parent_id}
            )
            if res.fetchone():
                conflicts.append(a["teacher_name"])
                continue
            booking_id = str(uuid.uuid4())
            await db.execute(
                text("INSERT INTO bookings (id, slot_id, parent_id, status) VALUES (:id, :sid, :pid, 'confirmed')"),
                {"id": booking_id, "sid": a["slot_id"], "pid": parent_id}
            )
            booked.append({
                "teacher_name": a["teacher_name"],
                "slot_id": a["slot_id"],
                "start_time": a["start_time"].isoformat(),
                "end_time": a["end_time"].isoformat(),
            })
        await db.commit()

    return {"booked": booked, "conflicts": conflicts}
