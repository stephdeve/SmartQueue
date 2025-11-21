import 'package:flutter/material.dart';
import 'package:smartqueue_user/core/app_router.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/data/models/establishment.dart';

class EstablishmentCard extends StatelessWidget {
  final Establishment establishment;

  const EstablishmentCard({super.key, required this.establishment});

  String _getAffluenceText(String affluence) {
    switch (affluence.toLowerCase()) {
      case 'low':
        return 'Peu fréquenté';
      case 'high':
        return 'Très fréquenté';
      case 'medium':
      default:
        return 'Fréquentation moyenne';
    }
  }

  Color _getAffluenceColor(String affluence) {
    switch (affluence.toLowerCase()) {
      case 'low':
        return Colors.green;
      case 'high':
        return Colors.red;
      case 'medium':
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.pushNamed(
          context,
          AppRouter.services,
          arguments: {
            'establishmentId': establishment.id,
            'establishmentName': establishment.name,
          },
        ),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              // Logo/Icon
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.store, size: 32, color: AppTheme.primaryColor),
              ),
              const SizedBox(width: 16),
              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      establishment.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    if (establishment.address != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Text(
                          establishment.address!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _getAffluenceColor(establishment.affluence)
                                .withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _getAffluenceColor(establishment.affluence),
                              width: 1,
                            ),
                          ),
                          child: Text(
                            _getAffluenceText(establishment.affluence),
                            style: TextStyle(
                              fontSize: 10,
                              color: _getAffluenceColor(establishment.affluence),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
