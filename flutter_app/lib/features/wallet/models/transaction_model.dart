class TransactionModel {
  final String publicId;
  final String type;
  final int amountPaise;
  final String description;
  final DateTime createdAt;

  TransactionModel({
    required this.publicId,
    required this.type,
    required this.amountPaise,
    required this.description,
    required this.createdAt,
  });

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      publicId: json['publicId'] as String? ?? '',
      type: json['type'] as String? ?? 'deposit',
      amountPaise: json['amountPaise'] as int? ?? 0,
      description: json['description'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }
}
